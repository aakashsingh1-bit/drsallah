import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Shield, Play, Award, ChevronRight, ChevronLeft } from "lucide-react";
import onboarding1 from "@/assets/onboarding-1.jpg";
import onboarding2 from "@/assets/onboarding-2.jpg";
import onboarding3 from "@/assets/onboarding-3.jpg";
import onboarding4 from "@/assets/onboarding-4.jpg";
import drLogo from "@/assets/dr-logo.png";
import { useNavigate } from "react-router-dom";

interface OnboardingScreenProps {
  onFinish?: () => void;
}

const onboardingSlides = [
  {
    icon: BookOpen,
    title: "Expert-Led Courses",
    description:
      "Access comprehensive clinical training for MRCP PACES, Arab Board & MD exams by Dr. Salah Alzait.",
    image: onboarding1,
  },
  {
    icon: Play,
    title: "Smooth Video Learning",
    description: "Watch adaptive video lessons that adjust to your internet — resume anytime, anywhere.",
    image: onboarding2,
  },
  {
    icon: Shield,
    title: "Secure Streaming",
    description: "Lessons stream securely in your account. Progress is saved as you learn.",
    image: onboarding3,
  },
  {
    icon: Award,
    title: "Track Your Progress",
    description: "Resume where you left off and monitor your exam preparation journey.",
    image: onboarding4,
  },
];

const OnboardingScreen = ({ onFinish }: OnboardingScreenProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = onboardingSlides[currentSlide];
  const isLast = currentSlide === onboardingSlides.length - 1;
  const navigate = useNavigate();

  const finish = () => {
    if (onFinish) onFinish();
    navigate("/login", { replace: true });
  };

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    setCurrentSlide((prev) => prev + 1);
  };

  const goPrev = () => {
    setCurrentSlide((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl bg-card rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-2">
        <div className="relative h-52 sm:h-64 md:h-auto min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentSlide}
              src={slide.image}
              alt=""
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-card/90 backdrop-blur px-3 py-1.5 rounded-full">
            <img src={drLogo} alt="" className="w-6 h-6 rounded" />
            <span className="text-xs font-bold text-foreground">Dr. Salah Alzait</span>
          </div>
        </div>

        <div className="p-6 sm:p-8 md:p-12 flex flex-col justify-center">
          <button
            type="button"
            onClick={finish}
            className="self-end text-xs font-semibold text-foreground/50 hover:text-foreground mb-6"
          >
            Skip →
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
            >
              <div className="w-14 h-14 rounded-2xl gradient-warm flex items-center justify-center mb-5 shadow-lg">
                <slide.icon size={26} className="text-accent-foreground" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-3">{slide.title}</h2>
              <p className="text-sm text-foreground/60 leading-relaxed mb-8">{slide.description}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-2 mb-6">
            {onboardingSlides.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === currentSlide ? "w-7 bg-accent" : "w-2 bg-foreground/20"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {currentSlide > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-foreground border border-border"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="flex-1 gradient-warm text-accent-foreground py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              {isLast ? "Get Started" : "Next"} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
