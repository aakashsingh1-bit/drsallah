import { motion } from "framer-motion";
import { BookOpen, CheckCircle, Clock, Award, ArrowRight, Play, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CourseCard } from "@/components/CourseCard";
import { useGetProfile } from "@/hooks/userAuthHooks";
import { useGetCourses, useGetMyLearning } from "@/hooks/useCoursesHooks";
import { formatDuration } from "@/lib/format";
import { useGetGallery } from "@/hooks/useApi";

const HomeScreen = () => {
  const navigate = useNavigate();
  const { data: profile } = useGetProfile();
  const { data: coursesRes, isLoading: coursesLoading } = useGetCourses();
  const { data: learningRes, isLoading: learningLoading } = useGetMyLearning();
  const { data: gallery = [] } = useGetGallery();

  const courses = coursesRes?.data || [];
  const enrolled = learningRes?.data || [];

  const totalCompleted = enrolled.reduce((sum: number, e: any) => sum + (e.progress?.watchedLessons || 0), 0);
  const totalLessons = enrolled.reduce((sum: number, e: any) => sum + (e.progress?.totalLessons || 0), 0);
  const avgProgress = enrolled.length
    ? Math.round(enrolled.reduce((s: number, e: any) => s + (e.progress?.percentComplete || 0), 0) / enrolled.length)
    : 0;

  return (
    <div className="space-y-8">
      <div className="gradient-hero rounded-3xl p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-accent/10 -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10">
          <p className="text-xs text-primary-foreground/70 font-medium mb-1">Welcome back 👋</p>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-primary-foreground mb-2">
            {profile?.name || localStorage.getItem("eduUsername") || "Student"}
          </h1>
          <p className="text-sm text-primary-foreground/80 max-w-xl">
            {enrolled.length
              ? `You have ${enrolled.length} active course(s) with ${avgProgress}% average progress.`
              : "Browse courses and start your exam preparation journey."}
          </p>
          <button
            onClick={() => navigate(enrolled.length ? "/dashboard/learning" : "/dashboard/courses")}
            className="mt-5 px-5 py-2.5 gradient-warm text-accent-foreground rounded-xl text-sm font-bold inline-flex items-center gap-2 shadow-lg"
          >
            {enrolled.length ? "Continue Learning" : "Browse Courses"} <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Enrolled Courses", value: String(enrolled.length), icon: BookOpen, color: "text-primary" },
          { label: "Watched Lessons", value: String(totalCompleted), icon: CheckCircle, color: "text-success" },
          { label: "Total Lessons", value: String(totalLessons), icon: Clock, color: "text-accent" },
          { label: "Avg Progress", value: `${avgProgress}%`, icon: Award, color: "text-primary" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
            <p className="text-xs text-foreground/50 font-medium">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {enrolled.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Continue Learning</h2>
            <button onClick={() => navigate("/dashboard/learning")} className="text-sm text-primary font-semibold">
              View all →
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {learningLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              enrolled.slice(0, 2).map((item: any) => (
                <button
                  key={item.enrollment?.purchaseId}
                  onClick={() =>
                    navigate(`/course-player/${item.course._id}`, { state: { course: item.course } })
                  }
                  className="text-left bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="relative h-40">
                    <img src={item.course.thumbnail} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-foreground/30 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full gradient-warm flex items-center justify-center">
                        <Play size={20} className="text-accent-foreground ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between mb-2">
                      <h3 className="font-bold text-foreground">{item.course.title}</h3>
                      <span className="text-sm font-bold text-accent">{item.progress?.percentComplete || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-warm"
                        style={{ width: `${item.progress?.percentComplete || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-foreground/50 mt-2">
                      {item.progress?.watchedLessons || 0}/{item.progress?.totalLessons || 0} lessons ·{" "}
                      {item.enrollment?.daysRemaining} days left
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Recommended for you</h2>
          <button onClick={() => navigate("/dashboard/courses")} className="text-sm text-primary font-semibold">
            Browse all →
          </button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coursesLoading ? (
            <Loader2 className="animate-spin col-span-full mx-auto" />
          ) : (
            courses.slice(0, 3).map((c: any) => (
              <CourseCard
                key={c._id}
                course={c}
                onClick={() => navigate(`/course-detail/${c._id}`, { state: { course: c } })}
              />
            ))
          )}
        </div>
      </div>

      {gallery.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4">Academy Gallery</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gallery.slice(0, 8).map((img: any) => (
              <div key={img._id} className="rounded-xl overflow-hidden border border-border aspect-square">
                <img
                  src={img.imageUrl || img.thumbnail}
                  alt={img.title || "Gallery"}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeScreen;
