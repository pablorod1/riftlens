export function ApiKeyNotice() {
  return (
    <div className="rounded-xl border border-loss/40 bg-loss-bg p-5 text-sm">
      <p className="font-semibold text-loss">No se puede conectar con la API de Riot</p>
      <p className="mt-1 text-muted">
        Falta <code className="text-fg">RIOT_API_KEY</code> en el <code className="text-fg">.env</code> de la raíz o la clave
        ha caducado (las de desarrollo duran 24 h). Genera una nueva en developer.riotgames.com y reinicia el servidor.
      </p>
    </div>
  );
}
