import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useGetCourses } from "@/hooks/useCoursesHooks";
import { CourseCard } from "@/components/CourseCard";

const CoursesScreen = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const category = params.get("category") || "All";

  const { data: allCoursesData } = useGetCourses();
  const { data: coursesData, isLoading } = useGetCourses({
    search: search || undefined,
    category: category !== "All" ? category : undefined,
  });

  const courses = coursesData?.data || [];

  const categories = useMemo(() => {
    const all = allCoursesData?.data || [];
    const set = new Set<string>();
    all.forEach((c: any) => c.category && set.add(c.category));
    return ["All", ...Array.from(set).sort()];
  }, [allCoursesData]);

  const onOpenCourse = (course: any) => {
    navigate(`/course-detail/${course._id}`, { state: { course } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Browse Courses</h1>
        <p className="text-sm text-foreground/60">
          {search ? `Results for "${search}"` : "Explore all available training programs"}
        </p>
      </div>

      <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Lock size={16} className="text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">DRM Protected Content</p>
          <p className="text-xs text-foreground/60">No downloads · Secure streaming only</p>
        </div>
      </div>

      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map((f) => (
            <button
              key={f}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (f === "All") next.delete("category");
                else next.set("category", f);
                setParams(next);
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                category === f
                  ? "gradient-warm text-accent-foreground shadow-sm"
                  : "bg-secondary text-foreground/70 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : courses.length > 0 ? (
          courses.map((course: any) => (
            <CourseCard key={course._id} course={course} onClick={() => onOpenCourse(course)} />
          ))
        ) : (
          <div className="col-span-full text-center text-muted-foreground py-10">No courses found.</div>
        )}
      </div>
    </div>
  );
};

export default CoursesScreen;
