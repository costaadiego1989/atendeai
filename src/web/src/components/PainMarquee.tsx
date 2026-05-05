import { XCircle } from "lucide-react";

const painItems = [
  "Cliente desistiu após 5 min",
  "Venda perdida às 02:00",
  "Concorrente respondeu primeiro",
  "Mensagem não lida há 3 horas",
  "Lead esfriou no fim de semana",
  "Cliente foi embora sem resposta",
  "Cobrança esquecida",
  "Lead não qualificado",
];

const PainMarquee = () => {
  const doubled = [...painItems, ...painItems];

  return (
    <section className="py-5 border-y border-primary/5 bg-card/20 overflow-hidden">
      <div className="animate-marquee flex gap-12 whitespace-nowrap w-max">
        {doubled.map((item, i) => (
          <span key={i} className="text-sm font-medium text-muted-foreground/50 flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5 text-destructive/50" /> {item}
          </span>
        ))}
      </div>
    </section>
  );
};

export default PainMarquee;
