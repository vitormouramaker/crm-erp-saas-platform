const express = require('express')
const rota = express.Router()
const execute = require('../services/execute_web')
const security = require('../security/cypher')
const send = require('../server/email')
const utils = require('../utils/templates')
const bunny = require('../utils/bunny_config')
const { rateLimit } = require('../security/rate_limit')

// Limites por IP (memoria do processo). Atras de proxy, "trust proxy" esta ligado no app.js.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: 'login' })
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, name: 'reset' })

// O link de onboarding e um JWT assinado (security.generateOnboardingToken),
// com validade. O token antigo era JSON em base64 sem assinatura: bastava saber
// o id da empresa e o e-mail para definir a senha de qualquer conta.
function parseOnboardingToken(token) {
    const payload = security.verifyOnboardingToken(token);
    if (!payload) {
        return null;
    }

    const empresaId = Number(payload.empresa_id || 0);
    const email = String(payload.email || "").trim().toLowerCase();
    if (!empresaId || !email) {
        return null;
    }

    return {
        empresa_id: empresaId,
        email,
        stripe_customer_id: payload.stripe_customer_id || null,
        pwv: String(payload.pwv || ""),
    };
}

function normalizeFeedbackType(value) {
    const tipo = String(value || "").trim().toLowerCase();
    if (
        tipo === "support" ||
        tipo === "suggestion" ||
        tipo === "pdv_interest" ||
        tipo === "data_request"
    ) {
        return tipo;
    }

    return null;
}

function buildDownloadFilename(value) {
    return String(value || "arquivo")
        .replace(/[\\/:*?"<>|]+/g, "_")
        .trim() || "arquivo";
}

async function handleChatMediaDownload(req, res) {
    try {
        const token = decodeURIComponent(String(req.params.token || "").trim());
        const tokenData = security.decryptChatMediaPublicToken(token);
        if (!tokenData) {
            return res.status(404).send('Arquivo indisponivel.');
        }

        const downloaded = await bunny.downloadFile(tokenData.path_bunny);
        const fileBuffer = Buffer.isBuffer(downloaded?.data)
            ? downloaded.data
            : Buffer.from(downloaded?.data || []);
        const fileName = buildDownloadFilename(tokenData.file_name);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
        );
        res.setHeader("Cache-Control", "private, max-age=300");
        res.setHeader("Content-Length", String(fileBuffer.length));
        return res.end(fileBuffer);
    } catch (error) {
        return res.status(404).send('Arquivo indisponivel.');
    }
}

rota.get('/m/:token', handleChatMediaDownload)
rota.get('/chat_media/:token', handleChatMediaDownload)

rota.post('/login', loginLimiter, async (req, res) => {
    try {
        const payload = req.body
        const data = security.jwtdecript(payload)
        if (!data) {
            return res.json(utils.jsonMount(false, [], 'Usuario/senha incorretos'))
        }
        const login = await execute.execute_login(data.user, data.pass)
        if (login.length <= 0) {
            return res.json(utils.jsonMount(false, [], 'Usuario/senha incorretos'))
        }
        res.setHeader("X-Session-Token", security.generateSessionToken(login[0]))
        return res.json(utils.jsonMount(true, login[0], 'Bem vindo!'))
    } catch (error) {
        return res.json(utils.errorHandle(error, '/login'))
    }
})


// O codigo de redefinicao e aleatorio, por usuario, guardado so como HMAC,
// expira em 15 minutos e aceita poucas tentativas. Antes era um TOTP global
// (mesma chave para todos): o codigo recebido no proprio e-mail redefinia a
// senha de qualquer outra conta durante a janela de validade.
rota.post('/forgot_pass', resetLimiter, async (req, res) => {
    try {
        const payload = req.body
        const data = security.jwtdecript(payload) || {}
        const email = String(data.email || '').trim().toLowerCase()
        const pedido = email ? await execute.execute_criar_codigo_reset(email) : null
        if (pedido?.codigo) {
            send.send_retrive_pass(pedido.email, pedido.codigo).catch((error) =>
                console.error('[forgot_pass] falha ao enviar e-mail:', error?.message || error)
            );
        }
        // Mesma resposta exista ou nao a conta (nao revela e-mails cadastrados).
        return res.json(utils.jsonMount(true, {}, 'Verifique sua caixa de Email!'))
    } catch (error) {
        return res.json(utils.errorHandle(error, '/forgot_pass'))
    }
})


rota.post('/new_pass', resetLimiter, async (req, res) => {
    try {
        const payload = req.body
        const data = security.jwtdecript(payload) || {}
        const senha = String(data.senha || '')
        if (senha.trim().length < 6) {
            return res.json(utils.jsonMount(false, {}, 'A senha deve ter pelo menos 6 caracteres.'))
        }
        const ok = await execute.execute_redefinir_senha_com_codigo(data.email, data.codigo, senha)
        if (!ok) {
            return res.json(utils.jsonMount(false, {}, 'Codigo invalido ou expirado.'))
        }
        return res.json(utils.jsonMount(true, {}, 'Senha alterada com sucesso!'))
    } catch (error) {
        return res.json(
            utils.jsonMount(false, {}, error?.message || 'Falha ao redefinir senha.')
        )
    }
})

rota.get('/onboarding_empresa', async (req, res) => {
    try {
        const token = String(req.query.token || "").trim();
        const tokenData = parseOnboardingToken(token);
        if (!tokenData) {
            return res.json(utils.jsonMount(false, {}, 'Token de onboarding invalido ou expirado.'))
        }

        const contexto = await execute.execute_get_onboarding_empresa(tokenData);
        if (!contexto?.empresa_id || security.passwordVersion(contexto.usuario_senha) !== tokenData.pwv) {
            return res.json(utils.jsonMount(false, {}, 'Cadastro nao encontrado para este token.'))
        }

        return res.json(
            utils.jsonMount(true, {
                empresa_id: contexto.empresa_id,
                email: contexto.usuario_email,
                nome_responsavel: contexto.usuario_nome || "",
                nome_fantasia: contexto.nome_fantasia || "",
                razao_social: contexto.razao_social || "",
                cnpj: contexto.cnpj || "",
                logradouro: contexto.logradouro || "",
                numero: contexto.numero || "",
                bairro: contexto.bairro || "",
                cidade: contexto.cidade || "",
                uf: contexto.uf || "",
                cep: contexto.cep || "",
            }, 'Dados de onboarding carregados com sucesso.')
        )
    } catch (error) {
        return res.json(
            utils.jsonMount(false, {}, error?.message || 'Falha ao carregar onboarding.')
        )
    }
})

rota.post('/onboarding_empresa', async (req, res) => {
    try {
        const payload = req.body
        const data = security.jwtdecript(payload)
        if (!data) {
            return res.json(utils.jsonMount(false, {}, 'Payload invalido.'))
        }

        const tokenData = parseOnboardingToken(String(data.token || "").trim())
        if (!tokenData) {
            return res.json(utils.jsonMount(false, {}, 'Token de onboarding invalido ou expirado.'))
        }

        await execute.execute_finalizar_onboarding_empresa({
            empresa_id: tokenData.empresa_id,
            email: tokenData.email,
            pwv: tokenData.pwv,
            nome_responsavel: data.nome_responsavel,
            senha: data.senha,
            nome_fantasia: data.nome_fantasia,
            razao_social: data.razao_social,
            cnpj: data.cnpj,
            logradouro: data.logradouro,
            numero: data.numero,
            bairro: data.bairro,
            cidade: data.cidade,
            uf: data.uf,
            cep: data.cep,
        })

        return res.json(utils.jsonMount(true, {}, 'Cadastro finalizado com sucesso!'))
    } catch (error) {
        return res.json(
            utils.jsonMount(false, {}, error?.message || 'Falha ao finalizar onboarding.')
        )
    }
})

rota.post('/enviar_feedback', resetLimiter, async (req, res) => {
    try {
        const data = security.jwtdecript(req.body)
        if (!data) {
            return res.json(utils.jsonMount(false, {}, 'Payload invalido ou expirado.'))
        }

        const tipo = normalizeFeedbackType(data.tipo)
        if (!tipo) {
            return res.json(utils.jsonMount(false, {}, 'Tipo de feedback invalido.'))
        }

        const assunto = String(data.assunto || "").trim()
        const mensagem = String(data.mensagem || "").trim()
        const emailUsuario = String(data.email_usuario || "").trim().toLowerCase()
        const usuarioId = Number(data.usuario_id || 0) || null
        const empresaId = Number(data.empresa_id || 0) || null
        const dadosFormulario =
            data?.dados_formulario && typeof data.dados_formulario === 'object'
                ? data.dados_formulario
                : null

        if (!assunto) {
            return res.json(utils.jsonMount(false, {}, 'Informe o assunto do contato.'))
        }

        if (tipo !== 'pdv_interest' && !mensagem) {
            return res.json(utils.jsonMount(false, {}, 'Informe a mensagem do contato.'))
        }

        if (tipo === 'pdv_interest' && !dadosFormulario) {
            return res.json(utils.jsonMount(false, {}, 'Informe os dados do interesse em PDV.'))
        }

        await send.send_feedback_email({
            tipo,
            assunto,
            mensagem,
            email_usuario: emailUsuario,
            usuario_id: usuarioId,
            empresa_id: empresaId,
            dados_formulario: dadosFormulario,
        })

        const successMessageByType = {
            support: 'Solicitacao de suporte enviada com sucesso!',
            suggestion: 'Sugestao enviada com sucesso!',
            pdv_interest: 'Solicitacao de implantacao enviada com sucesso!',
            data_request: 'Solicitacao de dados enviada com sucesso!',
        }

        return res.json(utils.jsonMount(true, {}, successMessageByType[tipo]))
    } catch (error) {
        return res.json(
            utils.jsonMount(false, {}, error?.message || 'Falha ao enviar contato.')
        )
    }
})

module.exports = rota
