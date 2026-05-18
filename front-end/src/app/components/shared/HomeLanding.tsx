import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { beginGoogleSignIn } from "../../lib/closet";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface HomeLandingProps {
  homeMessage: { kind: "error" | "success"; text: string } | null;
}

export function HomeLanding({ homeMessage }: HomeLandingProps) {
  return (
    <section className="flex flex-1 items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl text-center"
      >
        <img
          src="/brand-mark.png"
          alt="Curated Closet logo"
          className="mx-auto mb-8 h-32 w-auto object-contain sm:h-40"
        />
        <PrimitiveText
          as="h1"
          variant="display"
          font="serif"
          className="mb-6"
          style={{
            fontSize: "clamp(3rem, 8vw, 5.5rem)",
            lineHeight: "0.95",
          }}
        >
          Curated Closet
        </PrimitiveText>
        <PrimitiveText
          as="p"
          variant="title"
          tone="muted"
          className="mb-10"
          style={{ lineHeight: "1.7" }}
        >
          Find your fit, faster.
        </PrimitiveText>
        <PrimitiveButton
          onClick={() => beginGoogleSignIn()}
          variant="outline"
          className="h-auto px-6 py-3"
        >
          Sign in with Google
          <ArrowRight className="h-4 w-4" />
        </PrimitiveButton>

        {homeMessage ? (
          <motion.div
            className={`mt-6 px-4 py-3 text-sm ${
              homeMessage.kind === "success"
                ? "border border-emerald-300/40 bg-emerald-50 text-emerald-900"
                : "border border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            <PrimitiveText as="p" variant="bodySm">
              {homeMessage.text}
            </PrimitiveText>
          </motion.div>
        ) : null}
      </motion.div>
    </section>
  );
}
