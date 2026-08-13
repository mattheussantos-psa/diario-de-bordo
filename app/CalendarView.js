import { TEMP_STYLE } from "../lib/config";
import { DIAS, mondayOf } from "../lib/week";

const DIA_LONGO = ["SEG.", "TER.", "QUA.", "QUI.", "SEX."];

// Agenda da semana: cada coluna é um dia, com os negócios que o closer planejou tocar.
export default function CalendarView({ rows, items, emptyLabel }) {
  const seg = mondayOf();
  const hojeStr = new Date().toDateString();

  const porDia = {};
  for (const d of DIAS) porDia[d.v] = [];
  const semDia = [];

  for (const r of rows) {
    if (!(r.id in items)) continue;
    const dia = items[r.id];
    if (dia && porDia[dia]) porDia[dia].push(r);
    else semDia.push(r);
  }

  const total = rows.filter((r) => r.id in items).length;

  if (total === 0) {
    return (
      <div className="card">
        <div className="cal-empty">{emptyLabel || "Nenhum negócio no plano desta semana ainda."}</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="cal-grid">
        {DIAS.map((d, i) => {
          const data = new Date(seg);
          data.setDate(data.getDate() + i);
          const isHoje = data.toDateString() === hojeStr;
          const lista = porDia[d.v];
          return (
            <div className={"cal-col" + (isHoje ? " hoje" : "")} key={d.v}>
              <div className="cal-head">
                <span className="cal-dow">{DIA_LONGO[i]}</span>
                <span className={"cal-day" + (isHoje ? " badge" : "")}>{data.getDate()}</span>
              </div>
              <div className="cal-body">
                {lista.length === 0 && <div className="cal-vazio">—</div>}
                {lista.map((r) => (
                  <a
                    className="cal-card"
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className={"cal-dot v-" + (TEMP_STYLE[r.temperatura] || "none")} />
                    <span className="cal-nome">{r.name}</span>
                    <span className="cal-meta">
                      {r.amountText}
                      {r.next.pill?.cls === "late" && <b className="cal-late">atrasada</b>}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {semDia.length > 0 && (
        <div className="cal-semdia">
          <div className="cal-semdia-lab">Sem dia definido ({semDia.length})</div>
          <div className="cal-semdia-list">
            {semDia.map((r) => (
              <a className="cal-card" key={r.id} href={r.url} target="_blank" rel="noreferrer">
                <span className={"cal-dot v-" + (TEMP_STYLE[r.temperatura] || "none")} />
                <span className="cal-nome">{r.name}</span>
                <span className="cal-meta">{r.amountText}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
