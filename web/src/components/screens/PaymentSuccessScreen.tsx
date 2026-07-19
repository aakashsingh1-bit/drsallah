import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { useGetCourse } from "@/hooks/useCoursesHooks";

const PaymentSuccessScreen = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const courseId = params.get("courseId") || "";
  const { data: course } = useGetCourse(courseId);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-24 h-24 rounded-full gradient-warm flex items-center justify-center mb-6 mx-auto shadow-2xl"
        >
          <CheckCircle size={48} className="text-accent-foreground" />
        </motion.div>
        <div className="flex items-center gap-1 justify-center mb-2">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-bold text-accent">Payment Successful</span>
          <Sparkles size={16} className="text-accent" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground mb-2">You&apos;re Enrolled!</h1>
        <p className="text-sm text-foreground/60 mb-6">
          You now have full access to <span className="font-bold">{course?.title || "your course"}</span>
        </p>
        {course?.thumbnail && (
          <img src={course.thumbnail} alt="" className="w-full h-32 object-cover rounded-2xl mb-6" />
        )}
        <button
          onClick={() =>
            navigate(`/course-player/${courseId}`, {
              state: { course, from: "/dashboard/learning" },
            })
          }
          className="w-full gradient-warm text-accent-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          Start Learning <ArrowRight size={16} />
        </button>
        <button onClick={() => navigate("/dashboard/learning")} className="mt-3 text-sm text-foreground/60">
          Go to My Learning
        </button>
      </motion.div>
    </div>
  );
};

export default PaymentSuccessScreen;
