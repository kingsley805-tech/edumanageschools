import { Card, CardContent } from "@/components/ui/card";
import { AiBrandIcon } from "./AiBrandIcon";
import { greetingForHour, getPromptCardsForRole } from "../lib/prompts";
import { AI_ASSISTANT_SHORT } from "../lib/branding";

type Props = {
  userName: string;
  role: string;
  onSelectPrompt: (prompt: string) => void;
};

export function AiWelcomeScreen({ userName, role, onSelectPrompt }: Props) {
  const cards = getPromptCardsForRole(role);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 md:py-16">
      <AiBrandIcon size="lg" rounded="2xl" className="mb-6 shadow-lg" />
      <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
        {greetingForHour(userName)}
      </h1>
      <p className="mt-2 text-center text-muted-foreground">
        How can {AI_ASSISTANT_SHORT} assist you today?
      </p>

      <div className="mt-10 grid w-full gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onSelectPrompt(card.prompt)}
            className="text-left"
          >
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
              <CardContent className="p-4">
                <p className="text-sm font-medium">{card.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.prompt}</p>
                <span className="ai-accent-text mt-2 inline-block text-[10px] uppercase tracking-wide opacity-80">
                  {card.category}
                </span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
