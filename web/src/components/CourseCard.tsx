import { motion } from "framer-motion";
import { Star, Clock, Users } from "lucide-react";
import { formatDuration, formatPrice } from "@/lib/format";

export function CourseCard({ course, onClick }: { course: any; onClick: () => void }) {
  const tier = (course.priceTiers || []).find((t: any) => t.isActive !== false);
  const priceLabel = tier
    ? formatPrice(tier.price, tier.currency)
    : null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      className="text-left bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all w-full group"
    >
      <div className="relative aspect-[16/9] bg-secondary overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-foreground/30 text-sm">
            No image
          </div>
        )}
        {course.category && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-bold bg-card/95 text-foreground shadow-sm">
            {course.category}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-foreground text-[15px] leading-snug line-clamp-2 mb-1.5 min-h-[2.5rem]">
          {course.title}
        </h3>
        {course.instructor?.name && (
          <p className="text-xs text-foreground/50 mb-2 truncate">{course.instructor.name}</p>
        )}
        <div className="flex items-center gap-3 text-xs mb-3">
          <span className="flex items-center gap-1 text-amber-600 font-bold">
            <Star size={12} fill="currentColor" />{" "}
            {course.rating?.average ? Number(course.rating.average).toFixed(1) : "New"}
          </span>
          <span className="flex items-center gap-1 text-foreground/45">
            <Clock size={12} /> {formatDuration(course.totalDuration)}
          </span>
          {course.totalEnrolled > 0 && (
            <span className="flex items-center gap-1 text-foreground/45">
              <Users size={12} /> {course.totalEnrolled}
            </span>
          )}
        </div>
        {priceLabel && (
          <p className="text-base font-extrabold text-foreground">{priceLabel}</p>
        )}
      </div>
    </motion.button>
  );
}
