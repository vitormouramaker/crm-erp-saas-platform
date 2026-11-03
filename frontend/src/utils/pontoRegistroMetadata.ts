export type GeolocalizacaoStatus =
  | "capturada"
  | "negada"
  | "indisponivel"
  | "timeout"
  | "erro"
  | "nao_solicitada";

export type PontoRegistroMetadata = {
  latitude?: number;
  longitude?: number;
  precisao_metros?: number;
  localizacao_capturada_em?: string;
  geolocalizacao_status: GeolocalizacaoStatus;
  geolocalizacao_autorizada?: boolean;
  timezone_cliente?: string;
  idioma_cliente?: string;
  plataforma_cliente?: string;
  user_agent?: string;
  dispositivo_mobile?: boolean;
  origem_registro: "web_colaborador" | "web_admin_manual";
  registrado_por_usuario_id?: number;
};

type CollectMetadataParams = {
  origem_registro: PontoRegistroMetadata["origem_registro"];
  registrado_por_usuario_id?: number;
  solicitarGeolocalizacao: boolean;
  timeoutMs?: number;
};

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
};

function isMobileDevice(nav: NavigatorWithUserAgentData) {
  const userAgent = nav.userAgent || "";
  const mobileByUserAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );
  const mobileByUserAgentData =
    typeof nav.userAgentData?.mobile === "boolean"
      ? nav.userAgentData.mobile
      : false;

  return mobileByUserAgent || mobileByUserAgentData;
}

function buildBaseMetadata(
  params: CollectMetadataParams
): PontoRegistroMetadata {
  if (typeof navigator === "undefined") {
    return {
      origem_registro: params.origem_registro,
      registrado_por_usuario_id: params.registrado_por_usuario_id,
      geolocalizacao_status: params.solicitarGeolocalizacao
        ? "indisponivel"
        : "nao_solicitada",
    };
  }

  const nav = navigator as NavigatorWithUserAgentData;

  return {
    origem_registro: params.origem_registro,
    registrado_por_usuario_id: params.registrado_por_usuario_id,
    geolocalizacao_status: params.solicitarGeolocalizacao
      ? "erro"
      : "nao_solicitada",
    timezone_cliente: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    idioma_cliente: nav.language || "",
    plataforma_cliente: nav.userAgentData?.platform || nav.platform || "",
    user_agent: nav.userAgent || "",
    dispositivo_mobile: isMobileDevice(nav),
  };
}

function getCurrentPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 0,
    });
  });
}

function resolveGeolocationStatus(error: GeolocationPositionError): GeolocalizacaoStatus {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "negada";
    case error.TIMEOUT:
      return "timeout";
    case error.POSITION_UNAVAILABLE:
      return "indisponivel";
    default:
      return "erro";
  }
}

export async function collectPontoRegistroMetadata(
  params: CollectMetadataParams
): Promise<PontoRegistroMetadata> {
  const baseMetadata = buildBaseMetadata(params);

  if (!params.solicitarGeolocalizacao) {
    return baseMetadata;
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      ...baseMetadata,
      geolocalizacao_status: "indisponivel",
      geolocalizacao_autorizada: false,
    };
  }

  try {
    const position = await getCurrentPosition(params.timeoutMs ?? 8000);

    return {
      ...baseMetadata,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      precisao_metros: position.coords.accuracy,
      localizacao_capturada_em: new Date(position.timestamp).toISOString(),
      geolocalizacao_status: "capturada",
      geolocalizacao_autorizada: true,
    };
  } catch (error) {
    const status =
      error && typeof error === "object" && "code" in error
        ? resolveGeolocationStatus(error as GeolocationPositionError)
        : "erro";

    return {
      ...baseMetadata,
      geolocalizacao_status: status,
      geolocalizacao_autorizada: false,
    };
  }
}

export function describeGeolocalizacaoStatus(status: GeolocalizacaoStatus): string {
  switch (status) {
    case "capturada":
      return "Localizacao anexada ao registro.";
    case "negada":
      return "Batida salva sem localizacao porque a permissao foi negada.";
    case "timeout":
      return "Batida salva sem localizacao porque a captura expirou.";
    case "indisponivel":
      return "Batida salva sem localizacao porque o dispositivo nao disponibilizou a posicao.";
    case "nao_solicitada":
      return "Registro salvo sem solicitar geolocalizacao.";
    default:
      return "Batida salva sem localizacao por falha na captura.";
  }
}

export function hasCapturedGeolocation(metadata: PontoRegistroMetadata): boolean {
  return (
    metadata.geolocalizacao_status === "capturada" &&
    typeof metadata.latitude === "number" &&
    Number.isFinite(metadata.latitude) &&
    typeof metadata.longitude === "number" &&
    Number.isFinite(metadata.longitude)
  );
}
