import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import drLogo from "@/assets/dr-logo.png";
import {
  useForgotPassword,
  useLogin,
  useLoginOtp,
  useRegister,
  useResetPassword,
  useVerifyLoginOtp,
  useVerifyOtp,
  useResendOtp,
} from "@/hooks/userAuthHooks";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// interface LoginScreenProps {
//   onLogin: () => void;
//   onShowOnboarding: () => void;
// }
type screen = "login" | "signup" | "forgot" | "otp" | "resetPassword";
type OtpPurpose = "register" | "login";
const LoginScreen = () => {
  const [screen, setScreen] = useState<screen>("login");
  const [isOtp, setIsOtp] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("register");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [userId, setUserId] = useState("");
  const [showPw, setShowPw] = useState(false);

  const { mutate: loginMutation, isPending: isLoginPending } = useLogin();
  const {mutate: loginOtpMutation, isPending: isLoginOtpPending} = useLoginOtp();
  const {mutate: verifyLoginOtpMutation, isPending: isVerifyLoginOtpPending} = useVerifyLoginOtp();
  const { mutate: registerMutation, isPending: isRegisterPending } =
    useRegister();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { mutate: verifyOtpMutation, isPending: isVerifyOtpPending } =
    useVerifyOtp();
  const { mutate: resendOtpMutation, isPending: isResendOtpPending } = useResendOtp();
  const { mutate: forgotPasswordMutation, isPending: isForgotPasswordPending } =
    useForgotPassword();
  const { mutate: resetPasswordMutation, isPending: isResetPasswordPending } =
    useResetPassword();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const navigate = useNavigate();

  const resetForm = () => {
    setPassword("");
    setOtp(Array(6).fill(""));
    setName("");
    setPhone("");
    setConfirmPassword("");
    setNewPassword("");
    setShowNewPw(false);
    setShowConfirmPw(false);
  };

  const goToDashboard = () => {
    resetForm();
    navigate("/dashboard", { replace: true });
  };
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loginMutation(
      { email, password },
      {
        onSuccess: (response: any) => {
          if (response?.accessToken || response?.success) {
            goToDashboard();
          }
        },
      },
    );
  };

  const handleLoginOtp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loginOtpMutation(
      { email: email },
      {
        onSuccess: (response: any) => {
          if (response?.success) {
            setOtpPurpose("login");
            setOtp(Array(6).fill(""));
            setScreen("otp");
          }
        },
      },
    )
  }
  const handleVerifyLoginOtp = () => {
    verifyLoginOtpMutation(
      { email, otp: otp.join("") },
      {
        onSuccess: (response: any) => {
          if (response?.accessToken) {
            goToDashboard();
            return;
          }
          toast.error(response?.message || "Could not start session. Please try again.");
        },
      }
    );
  };

  const handleVerifyOtpSubmit = () => {
    if (otpPurpose === "login") {
      handleVerifyLoginOtp();
      return;
    }
    if (!userId) {
      toast.error("Missing account reference. Please register again.");
      setScreen("signup");
      return;
    }
    verifyOtpMutation(
      { otp: otp.join(""), userId },
      {
        onSuccess: (response: any) => {
          if (response?.accessToken) {
            goToDashboard();
            return;
          }
          toast.success("Email verified. Please sign in.");
          setScreen("login");
        },
      }
    );
  };

  const handleResendOtp = () => {
    resendOtpMutation(
      otpPurpose === "login" ? { email } : { userId: userId || undefined, email: email || undefined }
    );
  };

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // if (name.trim() === "" || email.trim() === "" || password.trim() === "" || phone.trim() === "") {
    //   toast.error("Please fill in all fields");
    //   return;
    // }
    // if (password !== confirmPassword) {
    //   toast.error("Passwords do not match");
    //   return;
    // }
    registerMutation(
      { name, email, password, phone },
      {
        onSuccess: (response: any) => {
          if (response?.success) {
            setUserId(response.userId || response.data?.userId || "");
            setOtpPurpose("register");
            setOtp(Array(6).fill(""));
            setScreen("otp");
          }
        },
        // onError: (error: any) => {
        //   toast.error(error.message || "Something went wrong");
        // }
      },
    );
  };

  const handleVerifyOtp = handleVerifyOtpSubmit;

  const handleForgotPassword = () => {
    forgotPasswordMutation(
      { email },
      {
        onSuccess: (response: any) => {
          if (response?.success) {
            setUserId(response.userId || response.data?.userId || "");
            setOtp(Array(6).fill(""));
            setScreen("resetPassword");
          }
        },
      },
    );
  };

  const handleResetPassword = () => {
    resetPasswordMutation(
      { newPassword, otp: otp.join(""), userId },
      {
        onSuccess: (response: any) => {
          if (response?.success) {
            setScreen("login");
            resetForm();
          }
        },
      },
    );
  };

  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < otp.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pastedData = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedData) return;

    const newOtp = [...otp];

    pastedData
      .slice(0, 6)
      .split("")
      .forEach((digit, index) => {
        newOtp[index] = digit;
      });

    setOtp(newOtp);

    const focusIndex = Math.min(pastedData.length, 6);
    inputRefs.current[focusIndex]?.focus();
  };
  return (
    <>
      {screen === "login" && (
        <>
          <div className="min-h-screen flex">
            <div className="hidden lg:flex w-1/2 gradient-hero p-10 xl:p-12 flex-col justify-between relative overflow-hidden min-h-screen">
              <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-accent/10 -translate-y-1/3 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-primary-foreground/5" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-primary-foreground/5 blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-accent/40 shadow-lg">
                    <img src="/img.png" alt="Dr. Salah Alzait" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h1 className="text-lg font-extrabold text-primary-foreground">
                      Dr. Salah Alzait
                    </h1>
                    <p className="text-xs text-primary-foreground/70 font-medium">
                      Medical Excellence Academy
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex flex-1 items-center justify-center py-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="relative"
                >
                  <div className="absolute -inset-4 rounded-full bg-accent/15 blur-2xl" />
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-accent/40 via-primary-foreground/20 to-accent/10 p-[3px]">
                    <div className="w-full h-full rounded-full bg-gradient-hero" />
                  </div>
                  <div className="relative w-52 h-52 xl:w-64 xl:h-64 rounded-full overflow-hidden ring-4 ring-primary-foreground/25 shadow-2xl">
                    <img
                      src="/img.png"
                      alt="Dr. Salah Alzait — Medical Excellence Academy"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                </motion.div>
              </div>

              <div className="relative z-10">
                <h2 className="text-4xl font-extrabold text-primary-foreground leading-tight mb-4">
                  Master Clinical Excellence
                </h2>
                <p className="text-sm text-primary-foreground/80 leading-relaxed mb-6 max-w-md">
                  Trusted by doctors worldwide for MRCP PACES, Arab Board, and MD exam preparation.
                </p>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-extrabold text-accent">Expert</p>
                    <p className="text-xs text-primary-foreground/60">Led courses</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-accent">DRM</p>
                    <p className="text-xs text-primary-foreground/60">Protected</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-accent">Live</p>
                    <p className="text-xs text-primary-foreground/60">Progress</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-8 bg-background">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
              >
                <div className="lg:hidden flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/20">
                    <img src="/img.png" alt="Dr. Salah Alzait" className="w-full h-full object-cover" />
                  </div>
                  <h1 className="font-extrabold text-foreground">
                    Dr. Salah Alzait
                  </h1>
                </div>
                <h2 className="text-2xl font-extrabold text-foreground mb-1">
                  Welcome back
                </h2>
                <p className="text-sm text-foreground/60 mb-6">
                  Sign in to continue your learning journey
                </p>

                <div className="flex bg-secondary rounded-xl p-1 mb-5">
            <button onClick={() => setIsOtp(false)} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${!isOtp ? "bg-card text-foreground shadow-sm" : "text-foreground/50"}`}>Email & Password</button>
            <button onClick={() => setIsOtp(true)} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${isOtp ? "bg-card text-foreground shadow-sm" : "text-foreground/50"}`}>OTP Login</button>
          </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if(isOtp) {
                      handleLoginOtp(e);
                    } else {
                      handleLogin(e);
                    }
                  }}
                >
                  <div className="relative mb-3">
                    <Mail
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={isOtp ? "Email or mobile" : "Email address"}
                      className="w-full bg-secondary rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                    />
                  </div>

                  {!isOtp ? (
                    <div className="relative mb-2">
                      <Lock
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
                      />
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full bg-secondary rounded-xl pl-10 pr-11 py-3 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                      />
                      <button
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isLoginOtpPending}
                      className="w-full gradient-warm text-accent-foreground py-3 rounded-xl text-sm font-semibold mb-3 shadow-md flex items-center justify-center gap-2"
                    >
                      {isLoginOtpPending ? "Sending OTP..." : "Send OTP"}
                      {!isLoginOtpPending && <ArrowRight size={16} />}
                      {isLoginOtpPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    </button>
                  )}

                  {!isOtp && (
                    <>
                    <button
                      className="self-end block ml-auto text-xs text-primary font-semibold mb-5"
                      onClick={() => setScreen("forgot")}
                    >
                      Forgot password?
                    </button>

                  <button
                    type="submit"
                    disabled={isLoginPending}
                    // onClick={handleLogin}
                    className="w-full gradient-warm text-accent-foreground py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
                    style={{
                      boxShadow: "0 8px 25px -8px hsl(43 90% 55% / 0.5)",
                    }}
                  >
                    {isLoginPending ? "Signing in..." : "Sign In"}{" "}
                    <ArrowRight size={16} />
                    {isLoginPending && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </button>
                    </>
                    
                  )}

                </form>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-foreground/40 font-medium">
                    OR
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <p
                  className="text-center text-sm text-foreground/60"
                  onClick={() => setScreen("signup")}
                >
                  Don't have an account?{" "}
                  <button className="text-primary font-bold">Sign up</button>
                </p>
                <button
                  className="w-full mt-4 text-xs text-foreground/50 hover:text-foreground font-semibold"
                  onClick={() => navigate("/")}
                >
                  New here? Take a tour →
                </button>
              </motion.div>
            </div>
          </div>
        </>
      )}

      {screen === "signup" && (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-border"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl overflow-hidden">
                <img src={drLogo} alt="logo" className="w-full h-full" />
              </div>
              <h1 className="font-extrabold text-foreground">
                Dr. Salah Alzait
              </h1>
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-1">
              Create your account
            </h2>
            <p className="text-sm text-foreground/60 mb-6">
              Create your account to start clinical exam preparation
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRegister(e);
              }}
            >
              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile number"
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 8 characters)"
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border"
                />
              </div>
              <label className="flex items-start gap-2 mt-4">
                <input type="checkbox" className="mt-0.5" />
                <span className="text-xs text-foreground/60">
                  I agree to the{" "}
                  <span className="text-primary font-semibold">
                    Terms of Service
                  </span>{" "}
                  and{" "}
                  <span className="text-primary font-semibold">
                    Privacy Policy
                  </span>
                </span>
              </label>
              <button
                type="submit"
                disabled={isRegisterPending}
                // onClick={handleRegister}
                className="w-full mt-5 gradient-warm text-accent-foreground py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                {isRegisterPending ? "Creating account..." : "Create Account"}{" "}
                <ArrowRight size={16} />
                {isRegisterPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
              </button>
            </form>

            <p className="text-center text-sm text-foreground/60 mt-5">
              Already have an account?{" "}
              <button
                onClick={() => setScreen("login")}
                className="text-primary font-bold"
              >
                Sign in
              </button>
            </p>
          </motion.div>
        </div>
      )}

      {screen === "forgot" && (
        <>
          <div className="min-h-screen flex items-center justify-center p-8 bg-background">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-border"
            >
              <button
                onClick={() => setScreen("login")}
                className="flex items-center gap-1 text-sm font-semibold text-foreground/60 mb-5"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <div className="w-12 h-12 rounded-2xl gradient-warm flex items-center justify-center mb-4">
                <Lock size={20} className="text-accent-foreground" />
              </div>
              <h2 className="text-2xl font-extrabold text-foreground mb-1">
                Forgot password?
              </h2>
              <p className="text-sm text-foreground/60 mb-6">
                Enter your email and we'll send you a reset link.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border mb-4"
              />
              <button
                className="w-full gradient-warm text-accent-foreground py-3.5 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2"
                disabled={isForgotPasswordPending}
                onClick={handleForgotPassword}
              >
                {isForgotPasswordPending
                  ? "Sending reset link..."
                  : "Send Reset Link"}{" "}
                <ArrowRight size={16} />
                {isForgotPasswordPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
              </button>
            </motion.div>
          </div>
        </>
      )}

      {screen === "otp" && (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-border"
          >
            <button
              onClick={() => setScreen(otpPurpose === "login" ? "login" : "signup")}
              className="flex items-center gap-1 text-sm font-semibold text-foreground/60 mb-5"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <h2 className="text-2xl font-extrabold text-foreground mb-1">
              Enter OTP
            </h2>

            <p className="text-sm text-foreground/60 mb-8">
              Enter the code sent to <span className="font-semibold text-foreground">{email}</span>
            </p>

            <div className="flex justify-center gap-3 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  className="w-14 h-14 rounded-xl border border-border bg-background text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                />
              ))}
            </div>

            <button
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition flex items-center justify-center gap-2"
              disabled={isVerifyOtpPending || isVerifyLoginOtpPending}
              onClick={handleVerifyOtp}
            >
              {(isVerifyOtpPending || isVerifyLoginOtpPending) ? "Verifying..." : "Verify OTP"}
              {!(isVerifyOtpPending || isVerifyLoginOtpPending) && <ArrowRight size={16} />}
              {(isVerifyOtpPending || isVerifyLoginOtpPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
            </button>

            <button
              type="button"
              disabled={isResendOtpPending}
              onClick={handleResendOtp}
              className="w-full mt-4 text-sm text-primary hover:underline disabled:opacity-50"
            >
              {isResendOtpPending ? "Sending..." : "Resend OTP"}
            </button>
          </motion.div>
        </div>
      )}

      {screen === "resetPassword" && (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-card rounded-3xl p-8 shadow-xl border border-border"
          >
            <button
              onClick={() => setScreen("login")}
              className="flex items-center gap-1 text-sm font-semibold text-foreground/60 mb-5"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="w-12 h-12 rounded-2xl gradient-warm flex items-center justify-center mb-4">
              <Lock size={20} className="text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-1">
              Enter OTP
            </h2>

            <p className="text-sm text-foreground/60 mb-8">
              Enter the 5-digit OTP sent to your email
            </p>

            <div className="flex justify-center gap-3 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  className="w-14 h-14 rounded-xl border border-border bg-background text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition"
                />
              ))}
            </div>
            <h2 className="text-2xl font-extrabold text-foreground mb-1">
              Reset Password
            </h2>
            <p className="text-sm text-foreground/60 mb-6">
              Enter your new password
            </p>
            <div className="relative mb-2">
              <input
                type={showNewPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border mb-4"
              />
              <button
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
              >
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative mb-2">
              <input
                type={showConfirmPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 border border-border mb-4"
              />
              <button
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/40"
              >
                {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              className="w-full gradient-warm text-accent-foreground py-3.5 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2"
              disabled={
                isResetPasswordPending ||
                newPassword !== confirmPassword ||
                newPassword.length < 8 ||
                confirmPassword.length < 8 ||
                !otp.every((digit) => digit !== "") ||
                !newPassword ||
                !confirmPassword
              }
              onClick={handleResetPassword}
            >
              {isResetPasswordPending
                ? "Resetting password..."
                : "Reset Password"}{" "}
              <ArrowRight size={16} />
              {isResetPasswordPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
};
export default LoginScreen;
