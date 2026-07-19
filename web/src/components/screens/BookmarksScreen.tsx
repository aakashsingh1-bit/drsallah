import { Bookmark, Loader2, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGetBookmarks } from "@/hooks/useCoursesHooks";
import { formatDuration } from "@/lib/format";

const BookmarksScreen = () => {
  const navigate = useNavigate();
  const { data: bookmarks = [], isLoading } = useGetBookmarks();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Bookmarks</h1>
        <p className="text-sm text-foreground/60">Lessons you saved for later</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin" />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-16 text-foreground/50">
          <Bookmark size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No bookmarked lessons yet.</p>
          <button
            onClick={() => navigate("/dashboard/learning")}
            className="mt-3 text-primary font-semibold text-sm"
          >
            Go to My Learning
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {bookmarks.map((lesson: any) => (
            <button
              key={lesson._id}
              onClick={() => {
                const courseId = lesson.course?._id || lesson.course;
                if (courseId) {
                  navigate(`/course-player/${courseId}`, {
                    state: { lessonId: lesson._id, from: "/dashboard/bookmarks" },
                  });
                }
              }}
              className="w-full flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-primary/20 text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Play size={16} className="text-primary ml-0.5" fill="currentColor" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{lesson.title}</p>
                <p className="text-xs text-foreground/50">{formatDuration(lesson.duration)}</p>
              </div>
              <Bookmark size={16} className="text-accent fill-accent shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookmarksScreen;
