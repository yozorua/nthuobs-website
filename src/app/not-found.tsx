import Link from "next/link";
import { Telescope, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <div
        className="nebula-glow-cyan"
        style={{ width: 400, height: 400, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      />
      <div className="relative z-10 text-center max-w-lg">
        <Telescope
          className="w-16 h-16 text-[#3f91ff]/30 mx-auto mb-6 animate-float"
          strokeWidth={1}
        />
        <h1 className="text-8xl font-bold text-gradient-cyan mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-[#eaebf2] mb-4">Page Not Found</h2>
        <p className="text-[#eaebf2]/40 mb-8 leading-relaxed">
          This part of the cosmos hasn&apos;t been mapped yet. The page you&apos;re looking for
          may have drifted into a black hole.
        </p>
        <Link
          href="/"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Return to Observatory
        </Link>
      </div>
    </div>
  );
}
