import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { greetingForHour, getPromptCardsForRole } from "../lib/prompts";

type Props = {
  userName: string;
  role: string;
  onSelectPrompt: (prompt: string) => void;
};

export function AiWelcomeScreen({ userName, role, onSelectPrompt }: Props) {
  const cards = getPromptCardsForRole(role);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 md:py-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
        <Sparkles className="h-7 w-7" />
      </div>
      <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
        {greetingForHour(userName)}
      </h1>
      <p className="mt-2 text-center text-muted-foreground">
        How can EduManage AI assist you today?
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
                <span className="mt-2 inline-block text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400">
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
