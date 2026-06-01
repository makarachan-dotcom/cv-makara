import type { ReactNode } from "react";

export type ContactAdminNoticeProps = {
  className?: string;
  cta?: ReactNode;
};

export default function ContactAdminNotice({ className, cta }: ContactAdminNoticeProps) {
  const baseClasses = "mt-4 rounded-xl border border-cyan-950/40 bg-cyan-950/10 px-4 py-3 text-xs text-slate-400 max-w-xl";
  const merged = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <div role="note" aria-label="Contact admin notice" className={merged}>
      <p className="font-semibold text-cyan-400 flex items-center gap-1.5">💡 ចង់បានទម្រង់ CV ផ្សេងពីនេះ?</p>
      <p className="mt-0.5 text-slate-300">
        អ្នកអាចទាក់ទងមកកាន់ Admin ដើម្បីស្នើសុំបង្កើតទម្រង់ (Template) ថ្មីបន្ថែមជូនអ្នកបានតាមតម្រូវការ!
      </p>
      <div className="my-2 border-t border-slate-800/60" />
      <p className="font-semibold text-cyan-400 flex items-center gap-1.5">💡 Need a different CV style?</p>
      <p className="mt-0.5 text-slate-300">
        Contact the admin to request a custom design template tailored to your specific professional requirements!
      </p>
      {cta ? <div className="mt-2">{cta}</div> : null}
    </div>
  );
}
