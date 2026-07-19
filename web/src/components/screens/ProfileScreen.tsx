import { LogOut, ShoppingBag, Loader2, Trash2, BookOpen, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useGetProfile,
  useLogout,
  useDeleteAccount,
} from "@/hooks/userAuthHooks";
import { useGetMyLearning } from "@/hooks/useCoursesHooks";
import { useGetMyPurchases } from "@/hooks/useApi";
import { formatPrice, timeAgo } from "@/lib/format";

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useGetProfile();
  const { data: purchases = [] } = useGetMyPurchases();
  const { data: learningRes } = useGetMyLearning();
  const { mutate: logout } = useLogout();
  const { mutate: deleteAccount, isPending: deleting } = useDeleteAccount();

  const enrolled = learningRes?.data || [];
  const totalWatched = enrolled.reduce(
    (s: number, e: any) => s + (e.progress?.watchedLessons || 0),
    0
  );
  const initials = (profile?.name || "U").charAt(0).toUpperCase();

  // Only show successful access — hide abandoned checkout / pending noise
  const activePurchases = purchases.filter((p: any) => p.status === "active");

  const handleLogout = () => {
    logout(undefined, { onSettled: () => navigate("/login") });
  };

  const handleDelete = () => {
    if (window.confirm("Delete your account permanently? This cannot be undone.")) {
      deleteAccount(undefined, { onSuccess: () => navigate("/login") });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="gradient-hero rounded-3xl p-7 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary-foreground/15 border-2 border-primary-foreground/20 flex items-center justify-center shrink-0">
            <span className="text-2xl sm:text-3xl font-extrabold text-primary-foreground">{initials}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-primary-foreground truncate">
              {profile?.name}
            </h1>
            <p className="text-sm text-primary-foreground/70 truncate">{profile?.email}</p>
            {profile?.phone && (
              <p className="text-sm text-primary-foreground/70 truncate">{profile.phone}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { v: String(enrolled.length), l: "Courses" },
          { v: String(totalWatched), l: "Lessons watched" },
          { v: String(activePurchases.length), l: "Active access" },
        ].map((s) => (
          <div
            key={s.l}
            className="bg-card border border-border rounded-2xl p-4 sm:p-5 text-center shadow-sm"
          >
            <p className="text-2xl font-extrabold text-foreground">{s.v}</p>
            <p className="text-xs text-foreground/50 font-medium mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">My Courses</h3>
            <p className="text-xs text-foreground/50">Active enrollments</p>
          </div>
        </div>

        {activePurchases.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="mx-auto text-foreground/25 mb-3" size={32} />
            <p className="text-sm text-foreground/60 mb-3">No active course access yet</p>
            <button
              onClick={() => navigate("/dashboard/courses")}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Browse courses
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {activePurchases.map((p: any) => {
              const thumb = p.course?.thumbnail;
              const title = p.course?.title || "Course";
              const endLabel = p.endDate
                ? `Access until ${new Date(p.endDate).toLocaleDateString()}`
                : `${p.months || "—"} mo · ${timeAgo(p.createdAt)}`;
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() =>
                    p.course?._id &&
                    navigate(`/course-player/${p.course._id}`, {
                      state: { course: p.course, from: "/dashboard/profile" },
                    })
                  }
                  className="w-full flex items-center gap-3 text-left rounded-xl p-3 hover:bg-secondary/60 border border-transparent hover:border-border transition-all"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-secondary"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <BookOpen size={20} className="text-foreground/35" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{title}</p>
                    <p className="text-xs text-foreground/50 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={12} className="text-success shrink-0" />
                      <span className="truncate">{endLabel}</span>
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary shrink-0">
                    {formatPrice(p.amountPaid, p.currency)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 p-3.5 bg-destructive/10 text-destructive rounded-2xl font-semibold hover:bg-destructive/15 transition-colors"
      >
        <LogOut size={18} /> Sign Out
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="w-full flex items-center justify-center gap-2 p-2.5 text-foreground/40 text-sm hover:text-destructive transition-colors"
      >
        <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete Account"}
      </button>
    </div>
  );
};

export default ProfileScreen;
