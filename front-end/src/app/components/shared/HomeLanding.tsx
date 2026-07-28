import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, PlayCircle } from "lucide-react";
import { beginGoogleSignIn } from "../../lib/closet";
import { PrimitiveButton } from "../primitives/PrimitiveButton";
import { PrimitiveConfirmationDialog } from "../primitives/PrimitiveConfirmationDialog";
import { PrimitiveText } from "../primitives/PrimitiveText";

interface HomeLandingProps {
  homeMessage: { kind: "error" | "success"; text: string } | null;
}

export function HomeLanding({ homeMessage }: HomeLandingProps) {
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);

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
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PrimitiveConfirmationDialog
            open={isAccessDialogOpen}
            onOpenChange={setIsAccessDialogOpen}
            title="Invite-only access"
            description="Curated Closet is currently private. Your Google email must be approved by our administrator before you can use the app. Contact annabel.m.goldman@gmail.com to request access. If your email is already approved, continue to Google sign in."
            cancelLabel="Cancel"
            confirmLabel="Continue to sign in"
            onConfirm={() => beginGoogleSignIn()}
          >
            <PrimitiveButton variant="outline" className="h-auto px-6 py-3">
              Sign in with an approved account
              <ArrowRight className="h-4 w-4" />
            </PrimitiveButton>
          </PrimitiveConfirmationDialog>
          <PrimitiveButton asChild className="h-auto px-6 py-3">
            <a href="/demo/curated-closet-demo.mp4" target="_blank" rel="noreferrer">
              <PlayCircle className="h-4 w-4" />
              Watch the 2-minute demo
            </a>
          </PrimitiveButton>
        </div>

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
