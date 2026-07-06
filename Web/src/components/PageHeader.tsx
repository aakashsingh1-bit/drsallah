import { ArrowLeft } from "lucide-react"
import drLogo from "@/assets/dr-logo.png";

export const PageHeader = ({onBack, title, badge, subtitle, right}: {onBack: () => void, title: string, badge?: string, subtitle?: string, right?: React.ReactNode}) => {
    return(

        <>
            <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-3 flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-foreground/70 hover:bg-secondary transition-colors">
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="h-8 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-accent/30 shrink-0">
            <img src={drLogo} alt="Dr. Salah" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-foreground truncate">{title}</h1>
              {badge && <span className="hidden sm:inline-block text-[10px] font-bold gradient-warm text-accent-foreground px-2 py-0.5 rounded-md">{badge}</span>}
            </div>
            {subtitle && <p className="text-[11px] text-foreground/55 font-medium truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
        </>
    )
}