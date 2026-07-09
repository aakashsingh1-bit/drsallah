import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi, courseApi, paymentApi, notificationApi, galleryApi } from "@/services/apiServices";
import { saveAuthSession, clearAuthSession } from "@/lib/session";

function handleAuthSuccess(response: any, queryClient: ReturnType<typeof useQueryClient>) {
  if (response?.accessToken && response?.user) {
    saveAuthSession(response);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (res) => {
      handleAuthSuccess(res, qc);
      toast.success(res.message || "Login successful");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLoginOtp() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) => authApi.loginOtp(email),
    onSuccess: (res) => toast.success(res.message || "Login code sent"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerifyLoginOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, otp }: { email: string; otp: string }) =>
      authApi.verifyLoginOtp(email, otp),
    onSuccess: (res) => {
      handleAuthSuccess(res, qc);
      toast.success(res.message || "Login successful");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (p: { name: string; email: string; password: string; phone: string }) =>
      authApi.register(p.name, p.email, p.password, p.phone),
    onSuccess: (res) => toast.success(res.message || "OTP sent to your email"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerifyOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ otp, userId }: { otp: string; userId: string }) =>
      authApi.verifyOtp(otp, userId),
    onSuccess: (res) => {
      handleAuthSuccess(res, qc);
      toast.success(res.message || "Email verified");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (p: { email?: string; userId?: string }) => authApi.resendOtp(p),
    onSuccess: (res) => toast.success(res.message || "OTP resent"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) => authApi.forgotPassword(email),
    onSuccess: (res) => toast.success(res.message || "OTP sent if email exists"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (p: { newPassword: string; otp: string; userId: string }) =>
      authApi.resetPassword(p.newPassword, p.otp, p.userId),
    onSuccess: (res) => toast.success(res.message || "Password reset"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGetProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => authApi.getProfile(),
    select: (res) => res?.user,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) => authApi.updateProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout().catch(() => null),
    onSettled: () => {
      clearAuthSession();
      qc.clear();
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: () => {
      clearAuthSession();
      qc.clear();
      toast.success("Account deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGetCourses(params?: { search?: string; category?: string }) {
  return useQuery({
    queryKey: ["courses", params],
    queryFn: () => courseApi.getCourses({ ...params, limit: 100 }),
  });
}

export function useGetCourse(id?: string) {
  return useQuery({
    queryKey: ["course", id],
    queryFn: () => courseApi.getCourse(id!),
    enabled: !!id,
    select: (res) => res?.data,
  });
}

export function useGetCourseContent(id?: string) {
  return useQuery({
    queryKey: ["courseContent", id],
    queryFn: () => courseApi.getCourseContent(id!),
    enabled: !!id,
    select: (res) => res?.data,
  });
}

export function useGetMyLearning() {
  return useQuery({
    queryKey: ["myLearning"],
    queryFn: () => courseApi.getMyLearning(),
  });
}

export function useGetModules(courseId?: string) {
  return useQuery({
    queryKey: ["modules", courseId],
    queryFn: () => courseApi.getModules(courseId!),
    enabled: !!courseId,
  });
}

export function useGetModuleLessons(moduleId?: string) {
  return useQuery({
    queryKey: ["moduleLessons", moduleId],
    queryFn: () => courseApi.getModuleLessons(moduleId!),
    enabled: !!moduleId,
    select: (res) => res?.data,
  });
}

export function useGetLessonStream(lessonId?: string, isFree?: boolean) {
  return useQuery({
    queryKey: ["lessonStream", lessonId, isFree],
    queryFn: () =>
      isFree ? courseApi.getFreeLessonStream(lessonId!) : courseApi.getLessonStream(lessonId!),
    enabled: !!lessonId,
    select: (res) => res?.data,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useGetWatchHistory() {
  return useQuery({
    queryKey: ["watchHistory"],
    queryFn: () => courseApi.getWatchHistory(),
    select: (res) => res?.data || [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateWatchHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, progress }: { lessonId: string; progress: number }) =>
      courseApi.updateWatchHistory(lessonId, progress),
    onSuccess: (res, { lessonId, progress }) => {
      const serverData = res?.data;
      const watchProgress = serverData?.percent != null
        ? {
            position: serverData.position ?? progress,
            percent: serverData.percent,
            completed: serverData.completed,
            watchedAt: serverData.watchedAt,
          }
        : { position: progress, percent: 0, completed: false };

      qc.setQueryData(["watchHistory"], (old: { data?: any[] } | undefined) => {
        const list = Array.isArray(old?.data) ? [...old.data] : [];
        const idx = list.findIndex(
          (h) => (h.lesson?._id || h.lesson)?.toString() === lessonId
        );
        const entry = {
          lesson: lessonId,
          progress: watchProgress.position,
          watchedAt: watchProgress.watchedAt || new Date().toISOString(),
          watchProgress,
        };
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...entry };
        } else {
          list.push(entry);
        }
        list.sort(
          (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
        );
        return { ...(old || { success: true }), data: list };
      });
    },
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, rating, comment }: { courseId: string; rating: number; comment?: string }) =>
      courseApi.submitReview(courseId, rating, comment),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["courseReviews", vars.courseId] });
      qc.invalidateQueries({ queryKey: ["courseContent", vars.courseId] });
      toast.success("Review submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGetCourseReviews(courseId?: string) {
  return useQuery({
    queryKey: ["courseReviews", courseId],
    queryFn: () => courseApi.getCourseReviews(courseId!),
    enabled: !!courseId,
    select: (res) => res?.data || [],
  });
}

export function useGetBookmarks() {
  return useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => courseApi.getBookmarks(),
    select: (res) => res?.data || [],
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => courseApi.toggleBookmark(lessonId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGetMyPurchases() {
  return useQuery({
    queryKey: ["purchases"],
    queryFn: () => paymentApi.getMyPurchases(),
    select: (res) => res?.data || [],
  });
}

export function useGetPlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => paymentApi.getPlans(),
    select: (res) => res?.data || [],
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => paymentApi.cancelSubscription(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Subscription cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGetGallery() {
  return useQuery({
    queryKey: ["gallery"],
    queryFn: () => galleryApi.getGallery(),
    select: (res) => res?.data || [],
  });
}

export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: ({ courseId, months }: { courseId: string; months: number }) =>
      paymentApi.createPaymentIntent(courseId, months),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      paymentIntentId,
    }: {
      courseId: string;
      paymentIntentId: string;
    }) => paymentApi.confirmPayment(courseId, paymentIntentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myLearning"] });
      qc.invalidateQueries({ queryKey: ["course"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: ({ courseId, months }: { courseId: string; months: number }) =>
      paymentApi.createCheckout(courseId, months),
    onSuccess: (res) => {
      if (res?.data?.checkoutUrl) window.location.href = res.data.checkoutUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGetNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.getNotifications(),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useGetMySubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: () => paymentApi.getMySubscription(),
    select: (res) => res?.data,
  });
}
