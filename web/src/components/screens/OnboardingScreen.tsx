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
  onFinish: () => void;
}

const onboardingSlides = [
  {
    icon: BookOpen,
    title: "Expert-Led Courses",
    description: "Access comprehensive clinical training for MRCP PACES, Arab Board & MD exams by Dr. Salah Alzait.",
    image: onboarding1,
    gradient: "from-primary/70 to-transparent",
  },
  {
    icon: Play,
    title: "Secure Video Streaming",
    description: "Watch high-quality video lessons with DRM protection. Content is streamed securely — no downloads allowed.",
    image: onboarding2,
    gradient: "from-primary/60 via-accent/20 to-transparent",
  },
  {
    icon: Shield,
    title: "Your Content is Protected",
    description: "AI-powered anti-piracy system prevents screen recording, screenshots, and unauthorized sharing.",
    image: onboarding3,
    gradient: "from-primary/50 to-transparent",
  },
  {
    icon: Award,
    title: "Track Your Progress",
    description: "Resume where you left off, track watch history, and monitor your exam preparation journey.",
    image: onboarding4,
    gradient: "from-accent/30 via-primary/40 to-transparent",
  },
];

const OnboardingScreen = ({ onFinish }: OnboardingScreenProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [idx, setIdx] = useState(0);
  const slide = onboardingSlides[currentSlide];
  const isLast = currentSlide === onboardingSlides.length - 1;
  const navigate = useNavigate();
  const goNext = () => {
    if (isLast) {
      navigate("/login");
      return;
    }
    setDirection(1);
    setCurrentSlide((prev) => prev + 1);
  };

  const goPrev = () => {
    setDirection(-1);
    setCurrentSlide(prev => prev - 1);
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <>
    <div className="min-h-screen gradient-hero flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-card rounded-3xl shadow-2xl overflow-hidden grid md:grid-cols-2">
        <div className="relative h-64 md:h-auto">
          <AnimatePresence mode="wait">
            <motion.img key={currentSlide} src={slide.image} alt={slide.title} initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full h-full object-cover" />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
          <div className="absolute top-5 left-5 flex items-center gap-2 bg-card/90 backdrop-blur px-3 py-1.5 rounded-full">
            <img src={drLogo} alt="logo" className="w-6 h-6 rounded" />
            <span className="text-xs font-bold text-foreground">Dr. Salah Alzait</span>
          </div>
        </div>

        <div className="p-8 md:p-12 flex flex-col justify-center">
            <button onClick={() => navigate("/login")} className="self-end text-xs font-semibold text-foreground/50 hover:text-foreground mb-6">Skip →</button>

          <AnimatePresence mode="wait">
            <motion.div key={idx} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <div className="w-14 h-14 rounded-2xl gradient-warm flex items-center justify-center mb-5 shadow-lg">
                <slide.icon size={26} className="text-accent-foreground" />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground mb-3">{slide.title}</h2>
              <p className="text-sm text-foreground/60 leading-relaxed mb-8">{slide.description}</p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-2 mb-6">
            {onboardingSlides.map((_, i) => (
              <motion.div key={i} animate={{ width: i === idx ? 28 : 8, backgroundColor: i === idx ? "hsl(43 90% 55%)" : "hsl(210 10% 50% / 0.3)" }} className="h-2 rounded-full" />
            ))}
          </div>

          <div className="flex gap-3">
            {/* {idx > 0 && (
              <button onClick={() => setIdx(idx - 1)} className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                <ChevronLeft size={18} />
              </button>
            )}
            <button onClick={() => isLast ? onFinish() : setIdx(idx + 1)} className="flex-1 gradient-warm text-accent-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
              {isLast ? "Get Started" : "Next"} <ChevronRight size={16} />
            </button> */}
            {currentSlide > 0 && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={goPrev}
              className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-foreground border border-border"
            >
              <ChevronLeft size={20} />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            className="flex-1 gradient-warm text-accent-foreground py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:opacity-90"
            style={{ boxShadow: "0 8px 25px -8px hsl(43 90% 55% / 0.5)" }}
          >
            {isLast ? "Get Started" : "Next"} <ChevronRight size={16} />
          </motion.button>
          </div>
        </div>
      </div>
    </div>
{/* ----- */}
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top bar with logo and skip */}
      <div className="flex items-center justify-between px-5 pt-4 relative z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-accent/30">
            <img src={drLogo} alt="Dr. Salah" className="w-full h-full object-cover" />
          </div>
          <span className="text-xs font-bold text-foreground">Dr. Salah Alzait</span>
        </div>
        <button
          onClick={onFinish}
          className="text-xs text-foreground/70 font-semibold px-4 py-1.5 rounded-full bg-secondary hover:bg-accent/20 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            {/* Image */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="relative w-72 h-52 rounded-3xl overflow-hidden mb-6 shadow-2xl"
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover"
                width={800}
                height={600}
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${slide.gradient}`} />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="absolute bottom-3 right-3 w-12 h-12 rounded-2xl gradient-warm flex items-center justify-center shadow-lg"
              >
                <slide.icon size={24} className="text-accent-foreground" strokeWidth={1.8} />
              </motion.div>
            </motion.div>

            {/* Text */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="text-xl font-extrabold text-foreground mb-3"
            >
              {slide.title}
            </motion.h2>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="text-sm text-foreground/65 leading-relaxed max-w-[280px] font-medium"
            >
              {slide.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-6 pb-10">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          {onboardingSlides.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === currentSlide ? 28 : 8,
                backgroundColor: i === currentSlide
                  ? "hsl(43 90% 55%)"
                  : "hsl(210 10% 50% / 0.3)",
              }}
              transition={{ duration: 0.3 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {currentSlide > 0 && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={goPrev}
              className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-foreground border border-border"
            >
              <ChevronLeft size={20} />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            className="flex-1 gradient-warm text-accent-foreground py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all hover:opacity-90"
            style={{ boxShadow: "0 8px 25px -8px hsl(43 90% 55% / 0.5)" }}
          >
            {isLast ? "Get Started" : "Next"} <ChevronRight size={16} />
          </motion.button>
        </div>
      </div>
    </div>
    </>
    
  );
};

export default OnboardingScreen;
