import { motion } from "framer-motion";
import { Star, Clock, ShieldCheck } from "lucide-react";
import { formatDuration } from "@/lib/format";

export function CourseCard({ course, onClick }: { course: any; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4 }}
      className="text-left bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl hover:border-accent/30 transition-all w-full"
    >
      <div className="relative h-44">
        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />
        {course.category && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold bg-card/90 text-foreground shadow-sm">
            {course.category}
          </span>
        )}
        <div className="absolute top-3 right-3">
          <div className="px-2 py-1 rounded-lg bg-foreground/60 backdrop-blur-sm flex items-center gap-1">
            <ShieldCheck size={10} className="text-primary-foreground" />
            <span className="text-[9px] font-bold text-primary-foreground">DRM</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-foreground mb-1">{course.title}</h3>
        <p className="text-xs text-foreground/55 line-clamp-2 mb-3 font-medium">{course.description}</p>
        <div className="flex items-center gap-3 text-xs mb-3">
          <span className="flex items-center gap-1 text-accent font-bold">
            <Star size={12} fill="currentColor" /> {course.rating?.average ?? "—"}
          </span>
          <span className="flex items-center gap-1 text-foreground/50">
            <Clock size={12} /> {formatDuration(course.totalDuration)}
          </span>
        </div>
        <span className="px-4 py-1.5 gradient-warm text-accent-foreground text-xs font-bold rounded-lg shadow-sm inline-block">
          View Details
        </span>
      </div>
    </motion.button>
  );
}
