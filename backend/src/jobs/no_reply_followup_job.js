const crypto = require("crypto");
const { postgres } = require("../server/connect");
const models = require("../models/models_no_reply_followup");
const whatsapp = require("../utils/templates");

const JOB_LOCK_KEY = 982451711;
const DELAY_HOURS = Math.max(Number(process.env.WHATSAPP_NO_REPLY_DELAY_HOURS || 6) || 6, 1);
const BATCH_SIZE = Math.min(
  Math.max(Number(process.env.WHATSAPP_NO_REPLY_BATCH_SIZE || 50) || 50, 1),
  200
);
const JOB_ENABLED = String(process.env.WHATSAPP_NO_REPLY_JOB_ENABLED || "true")
  .trim()
  .toLowerCase() === "true";

async function runNoReplyFollowupJobCycle() {
  if (!JOB_ENABLED) {
    console.info("[no-reply-followup-job] desabilitado; defina WHATSAPP_NO_REPLY_JOB_ENABLED=true.");
    return { skipped: true, sent: 0, errors: 0 };
  }
  const client = await postgres.connect();
  let locked = false;
  let sent = 0;
  let errors = 0;
  try {
    const lockRet = await client.query("select pg_try_advisory_lock($1) as locked", [JOB_LOCK_KEY]);
    locked = Boolean(lockRet.rows?.[0]?.locked);
    if (!locked) return { skipped: true, sent, errors };

    const candidates = await client.query(models.list_candidates(), [DELAY_HOURS, BATCH_SIZE]);
    for (const candidate of candidates.rows) {
      const lockToken = crypto.randomUUID();
      const claimRet = await client.query(models.claim(), [
        candidate.conversa_id,
        candidate.mensagem_gatilho_id,
        candidate.empresa_id,
        lockToken,
      ]);
      const claim = claimRet.rows?.[0];
      if (!claim) continue;

      try {
        const eligibleRet = await client.query(models.still_eligible(), [
          candidate.conversa_id,
          candidate.mensagem_gatilho_id,
          DELAY_HOURS,
        ]);
        if (!eligibleRet.rows?.[0]?.eligible) {
          await client.query(models.mark_error(), [claim.id, "Cliente respondeu antes do envio.", lockToken]);
          continue;
        }

        const response = await whatsapp.sendWhatsappMessage(
          candidate.telefone,
          candidate.texto,
          candidate.conversa_id,
          candidate.texto,
          candidate.empresa_id,
          candidate.usuario_id || null
        );
        const whatsappMessageId = response?.messages?.[0]?.id || null;
        await client.query(models.mark_sent(), [claim.id, whatsappMessageId, lockToken]);
        sent += 1;
      } catch (error) {
        errors += 1;
        await client.query(models.mark_error(), [claim.id, error?.message || String(error), lockToken]);
        console.error("[no-reply-followup-job] falha no envio", {
          conversa_id: candidate.conversa_id,
          empresa_id: candidate.empresa_id,
          error: error?.message || String(error),
        });
      }
    }
    return { skipped: false, sent, errors };
  } finally {
    if (locked) {
      try {
        await client.query("select pg_advisory_unlock($1)", [JOB_LOCK_KEY]);
      } catch (error) {
        console.warn("[no-reply-followup-job] falha ao liberar lock:", error.message);
      }
    }
    client.release();
  }
}

module.exports = { runNoReplyFollowupJobCycle };
