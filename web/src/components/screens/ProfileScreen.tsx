import { useState } from "react";
import { ChevronRight, LogOut, CreditCard, User, Loader2, Trash2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useGetProfile,
  useUpdateProfile,
  useLogout,
  useDeleteAccount,
} from "@/hooks/userAuthHooks";
import { useGetMyLearning } from "@/hooks/useCoursesHooks";
import {
  useGetMySubscription,
  useGetMyPurchases,
  useGetPlans,
  useCancelSubscription,
} from "@/hooks/useApi";
import { formatPrice } from "@/lib/format";
import { timeAgo } from "@/lib/format";

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useGetProfile();
  const { data: subscription } = useGetMySubscription();
  const { data: purchases = [] } = useGetMyPurchases();
  const { data: plans = [] } = useGetPlans();
  const { data: learningRes } = useGetMyLearning();
  const { mutate: logout } = useLogout();
  const { mutate: deleteAccount, isPending: deleting } = useDeleteAccount();
  const { mutate: updateProfile, isPending: saving } = useUpdateProfile();
  const { mutate: cancelSub, isPending: cancelling } = useCancelSubscription();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const enrolled = learningRes?.data || [];
  const totalWatched = enrolled.reduce((s: number, e: any) => s + (e.progress?.watchedLessons || 0), 0);
  const initials = (profile?.name || "U").charAt(0).toUpperCase();

  const startEdit = () => {
    setName(profile?.name || "");
    setPhone(profile?.phone || "");
    setEditing(true);
  };

  const saveProfile = () => {
    updateProfile({ name, phone }, { onSuccess: () => setEditing(false) });
  };

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
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="gradient-hero rounded-3xl p-8 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-primary-foreground/15 border-2 border-primary-foreground/20 flex items-center justify-center">
            <span className="text-3xl font-extrabold text-primary-foreground">{initials}</span>
          </div>
          <div className="flex-1">
            {editing ? (
              <div className="space-y-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-primary-foreground/10 rounded-lg px-3 py-2 text-primary-foreground text-sm"
                  placeholder="Name"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-primary-foreground/10 rounded-lg px-3 py-2 text-primary-foreground text-sm"
                  placeholder="Phone"
                />
                <div className="flex gap-2">
                  <button onClick={saveProfile} disabled={saving} className="px-4 py-1.5 gradient-warm rounded-lg text-xs font-bold">
                    Save
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-xs text-primary-foreground/70">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold text-primary-foreground">{profile?.name}</h1>
                <p className="text-sm text-primary-foreground/70">{profile?.email}</p>
                {profile?.phone && <p className="text-sm text-primary-foreground/70">{profile.phone}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { v: String(enrolled.length), l: "Courses" },
          { v: String(totalWatched), l: "Lessons" },
          { v: subscription?.status === "active" ? "Active" : "—", l: "Subscription" },
        ].map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-2xl font-extrabold text-foreground">{s.v}</p>
            <p className="text-xs text-foreground/50 font-medium">{s.l}</p>
          </div>
        ))}
      </div>

      <button
        onClick={startEdit}
        className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl border border-border hover:border-primary/20 text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <User size={18} className="text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-foreground">Edit Profile</h4>
          <p className="text-xs text-foreground/50">Update name and phone</p>
        </div>
        <ChevronRight size={16} className="text-foreground/30" />
      </button>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">Platform Subscription</h3>
        </div>
        {subscription?.status === "active" ? (
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              <span className="font-semibold">{subscription.plan?.name || subscription.plan?.type}</span>
              {" · "}ends {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : "—"}
            </p>
            <button
              disabled={cancelling}
              onClick={() => cancelSub()}
              className="text-sm text-destructive font-semibold"
            >
              Cancel subscription
            </button>
          </div>
        ) : plans.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-foreground/50 mb-2">Available plans (contact support to activate):</p>
            {plans.map((plan: any) => (
              <div key={plan._id} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
                <span className="font-medium">{plan.name || plan.type}</span>
                <span className="text-primary font-bold">{formatPrice(plan.price, plan.currency)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground/50">No active platform subscription</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingBag size={18} className="text-primary" />
          <h3 className="font-bold text-foreground">Course Purchases</h3>
        </div>
        {purchases.length === 0 ? (
          <p className="text-sm text-foreground/50">No purchases yet</p>
        ) : (
          <div className="space-y-3">
            {purchases.map((p: any) => (
              <button
                key={p._id}
                onClick={() => p.course?._id && navigate(`/course-detail/${p.course._id}`)}
                className="w-full flex items-center gap-3 text-left hover:bg-secondary/30 rounded-lg p-2 -mx-2"
              >
                {p.course?.thumbnail && (
                <img src={p?.course?.thumbnail} alt={p?.course?.title} className="w-12 h-12 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{p.course?.title || "Course"}</p>
                  <p className="text-xs text-foreground/50">
                    {p.status} · {p.months} mo · {timeAgo(p.createdAt)}
                  </p>
                </div>
                <span className="text-xs font-bold text-primary">{formatPrice(p.amountPaid, p.currency)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 p-3.5 bg-destructive/10 text-destructive rounded-2xl font-semibold hover:bg-destructive/20"
      >
        <LogOut size={18} /> Sign Out
      </button>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-full flex items-center justify-center gap-2 p-3 text-foreground/40 text-sm hover:text-destructive"
      >
        <Trash2 size={14} /> Delete Account
      </button>
    </div>
  );
};

export default ProfileScreen;
