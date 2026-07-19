import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">Browse courses</h1>
        <p className="text-sm text-foreground/55 mt-1">
          {search ? `Results for “${search}”` : "Explore training programs from the academy"}
        </p>
      </div>

      {categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {categories.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                if (f === "All") next.delete("category");
                else next.set("category", f);
                setParams(next);
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                category === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-foreground/65 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : courses.length > 0 ? (
          courses.map((course: any) => (
            <CourseCard key={course._id} course={course} onClick={() => onOpenCourse(course)} />
          ))
        ) : (
          <div className="col-span-full text-center text-foreground/50 py-12 text-sm">
            No courses found.
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursesScreen;
