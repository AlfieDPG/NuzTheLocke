// ---------- Cara a cara ----------
//
// Tú contra un amigo: cuántos lockes habéis jugado juntos y cuántos ha ganado cada uno. Lo
// usan la rivalidad de «Amigos» y el perfil (js/perfil.js), para que digan lo mismo.
//
// Sale de dos sitios, sin contar nada dos veces (el id de cada locke):
//   · los lockes de «Lockes» en los que estáis los dos (aceptados): todos cuentan como
//     jugados, y los cerrados tienen ganador;
//   · los lockes ganados apuntados a mano (los de antes de Versus): si en uno tuyo sale él
//     como participante, es una victoria tuya contra él, y al revés;
//   · los perdidos apuntados (perfil.perdidos) en los que sale el otro: jugados juntos, que
//     normalmente ganó un tercero.

import { misLockes, estadoDe } from "./lockes.js";

function mismoNombre(uno, otro) {
  return String(uno || "").trim().toLowerCase() === String(otro || "").trim().toLowerCase();
}

// Fecha para ordenar: la de fin si la hay ("2025-03-01"); si no, la de creación del locke
function fechaParaOrdenar(locke) {
  if (locke.fechaFin) return locke.fechaFin;
  return locke.creado ? new Date(locke.creado).toISOString().slice(0, 10) : "";
}

// mio y suyo: perfiles. Devuelve { juntos, enMarcha, mias, suyas, lista }
export function caraACara(mio, suyo) {
  const vistos = new Set();
  const cuenta = { juntos: 0, enMarcha: 0, mias: 0, suyas: 0, lista: [] };

  for (const locke of misLockes()) {
    const jugadores = locke.jugadores || [];
    if (!jugadores.includes(suyo.uid) || estadoDe(locke, suyo.uid) !== "aceptado") continue;
    vistos.add(locke.id);
    cuenta.juntos++;

    let resultado = "otro";
    if (locke.estado !== "cerrado") resultado = "marcha";
    else if (locke.ganador === mio.uid) resultado = "mia";
    else if (locke.ganador === suyo.uid) resultado = "suya";

    if (resultado === "marcha") cuenta.enMarcha++;
    if (resultado === "mia") cuenta.mias++;
    if (resultado === "suya") cuenta.suyas++;

    cuenta.lista.push({
      nombre: locke.nombre,
      tipo: locke.tipo,
      fecha: fechaParaOrdenar(locke),
      resultado,
      ganador: (locke.nombres || {})[locke.ganador] || ""
    });
  }

  const sumar = (ganados, rival, campo, resultado) => {
    for (const ganado of ganados || []) {
      if (vistos.has(ganado.id)) continue;
      if (!(ganado.participantes || []).some((p) => mismoNombre(p.nombre, rival.nombre))) continue;
      vistos.add(ganado.id);
      cuenta.juntos++;
      cuenta[campo]++;
      cuenta.lista.push({ nombre: ganado.nombre, tipo: ganado.tipo, fecha: ganado.fechaFin || "", resultado });
    }
  };
  sumar(mio.ganados, suyo, "mias", "mia");
  sumar(suyo.ganados, mio, "suyas", "suya");

  // Los que uno de los dos perdió con el otro dentro: si lo ganó el otro ya salió arriba (es el
  // mismo id), así que aquí suelen ser de un tercero. Por si acaso, se mira el nombre de quien ganó.
  const sumarPerdidos = (perdidos, rival) => {
    for (const perdido of perdidos || []) {
      if (vistos.has(perdido.id)) continue;
      if (!(perdido.participantes || []).some((p) => p.uid === rival.uid || p.id === rival.uid || mismoNombre(p.nombre, rival.nombre))) continue;
      vistos.add(perdido.id);
      cuenta.juntos++;
      let resultado = "otro";
      if (mismoNombre(perdido.ganador, mio.nombre)) resultado = "mia";
      else if (mismoNombre(perdido.ganador, suyo.nombre)) resultado = "suya";
      if (resultado === "mia") cuenta.mias++;
      if (resultado === "suya") cuenta.suyas++;
      cuenta.lista.push({ nombre: perdido.nombre, tipo: perdido.tipo, fecha: perdido.fechaFin || "", resultado, ganador: perdido.ganador || "" });
    }
  };
  sumarPerdidos(mio.perdidos, suyo);
  sumarPerdidos(suyo.perdidos, mio);

  return cuenta;
}
