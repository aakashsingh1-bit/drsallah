import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import WebApp from "./pages/Web.tsx";
import NotFound from "./pages/NotFound.tsx";
import LoginScreen from "./components/screens/LoginScreen.tsx";
import HomeScreen from "./components/screens/HomeScreen.tsx";
import CoursesScreen from "./components/screens/CoursesScreen.tsx";
import MyLearningScreen from "./components/screens/MyLearningScreen.tsx";
import NotificationsScreen from "./components/screens/NotificationsScreen.tsx";
import ProfileScreen from "./components/screens/ProfileScreen.tsx";
import BookmarksScreen from "./components/screens/BookmarksScreen.tsx";
import GuestRoute from "./routes/GuestRoutes.tsx";
import ProtectedRoute from "./routes/ProtectedRoutes.tsx";
import CourseDetailScreen from "./components/screens/CourseDetailScreen.tsx";
import CoursePlayerScreen from "./components/screens/CoursePlayerScreen.tsx";
import PaymentScreen from "./components/screens/PaymentScreen.tsx";
import PaymentSuccessScreen from "./components/screens/PaymentSuccessScreen.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginScreen />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="course-detail/:id" element={<CourseDetailScreen />} />
            <Route path="course-player/:courseId" element={<CoursePlayerScreen />} />
            <Route path="purchase-course/:id" element={<PaymentScreen />} />
            <Route path="payment/success" element={<PaymentSuccessScreen />} />
            <Route element={<WebApp />} path="/dashboard">
              <Route index element={<HomeScreen />} />
              <Route path="courses" element={<CoursesScreen />} />
              <Route path="learning" element={<MyLearningScreen />} />
              <Route path="bookmarks" element={<BookmarksScreen />} />
              <Route path="notifications" element={<NotificationsScreen />} />
              <Route path="profile" element={<ProfileScreen />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
