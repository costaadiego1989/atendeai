import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

type ProspectingChannel = 'WHATSAPP' | 'INSTAGRAM';

type ProspectingChannelSelectorProps =
  | {
      mode: 'single';
      value: ProspectingChannel;
      onChange: (channel: ProspectingChannel) => void;
    }
  | {
      mode: 'multiple';
      value: ProspectingChannel[];
      onChange: (channel: ProspectingChannel) => void;
    };

const CHANNEL_OPTIONS: Array<{
  value: ProspectingChannel | 'LINKEDIN';
  label: string;
  disabled?: boolean;
}> = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'LINKEDIN', label: 'LinkedIn', disabled: true },
];

function isAvailableChannel(value: ProspectingChannel | 'LINKEDIN'): value is ProspectingChannel {
  return value !== 'LINKEDIN';
}

export function ProspectingChannelSelector(
  props: ProspectingChannelSelectorProps,
) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-muted/10 p-3 sm:grid-cols-3">
      {CHANNEL_OPTIONS.map((channel) => {
        const active =
          isAvailableChannel(channel.value) &&
          (props.mode === 'single'
            ? props.value === channel.value
            : props.value.includes(channel.value));

        return (
          <button
            key={channel.value}
            type="button"
            disabled={channel.disabled}
            onClick={() => {
              if (isAvailableChannel(channel.value)) {
                props.onChange(channel.value);
              }
            }}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              active
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/60 bg-background text-foreground'
            } ${channel.disabled ? 'cursor-not-allowed opacity-65' : ''}`}
          >
            {props.mode === 'multiple' ? (
              <Checkbox
                checked={active}
                disabled={channel.disabled}
                onCheckedChange={() => {
                  if (isAvailableChannel(channel.value)) {
                    props.onChange(channel.value);
                  }
                }}
              />
            ) : null}
            <span>{channel.label}</span>
            {channel.disabled ? (
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                Em breve
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
