import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard, Loader2, ShieldCheck, Lock } from "lucide-react";
import { PageHeader } from "../PageHeader";
import { useGetCourse } from "@/hooks/useCoursesHooks";
import { useCreatePaymentIntent, useConfirmPayment } from "@/hooks/useApi";
import { formatDuration, formatPrice } from "@/lib/format";
import { isStripeConfigured, stripePromise } from "@/lib/stripe";
import { toast } from "sonner";

type IntentData = {
  clientSecret: string;
  paymentIntentId: string;
};

function StripePaymentForm({
  courseId,
  amountLabel,
  onBack,
  onSuccess,
}: {
  courseId: string;
  amountLabel: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { mutateAsync: confirmOnServer, isPending: confirming } = useConfirmPayment();
  const [paying, setPaying] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [elementError, setElementError] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      toast.error("Payment form is still loading. Please wait a moment.");
      return;
    }
    if (!elementReady) {
      toast.error("Please wait for the payment form to load.");
      return;
    }

    setPaying(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        toast.error(submitError.message || "Please check your payment details");
        return;
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        toast.error(error.message || "Payment failed");
        return;
      }

      if (paymentIntent?.status === "succeeded") {
        try {
          await confirmOnServer({ courseId, paymentIntentId: paymentIntent.id });
        } catch (confirmErr: any) {
          const msg = String(confirmErr?.message || "");
          // Webhook may have activated already — treat as success
          if (!/already activated|not found/i.test(msg)) {
            throw confirmErr;
          }
        }
        toast.success("Payment successful");
        onSuccess();
        return;
      }

      if (paymentIntent?.status === "processing") {
        toast.message("Payment is processing. Access will unlock shortly.");
        onSuccess();
        return;
      }

      toast.error(`Payment status: ${paymentIntent?.status || "unknown"}. Please contact support if charged.`);
    } catch (err: any) {
      toast.error(err?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const busy = paying || confirming;

  return (
    <form onSubmit={handlePay} className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-6 min-h-[200px]">
        <h2 className="font-bold text-foreground mb-4">Payment details</h2>
        {elementError ? (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
            {elementError}
            <p className="mt-2 text-foreground/60">
              Check that <code className="text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code> matches your Stripe account.
            </p>
          </div>
        ) : (
          <>
            {!elementReady && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-primary" />
                <span className="ml-2 text-sm text-foreground/60">Loading secure payment form…</span>
              </div>
            )}
            <div className={elementReady ? "" : "sr-only"}>
              <PaymentElement
                options={{ layout: "tabs" }}
                onReady={() => setElementReady(true)}
                onLoadError={(e) => setElementError(e.error?.message || "Failed to load payment form")}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="px-5 py-3 rounded-xl border border-border text-sm font-semibold"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || !elementReady || !!elementError || busy}
          className="flex-1 gradient-warm text-accent-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : null}
          Pay {amountLabel}
        </button>
      </div>
      <p className="text-xs text-center text-foreground/50 flex items-center justify-center gap-1">
        <Lock size={12} /> Secured by Stripe · Card data never touches our servers
      </p>
    </form>
  );
}

const PaymentScreen = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const location = useLocation();
  const stateCourse = (location.state as { course?: any })?.course;
  const { data: courseData, isLoading } = useGetCourse(id);
  const course = courseData || stateCourse;
  const tiers = (course?.priceTiers || []).filter((t: any) => t.isActive);
  const [months, setMonths] = useState(1);
  const [intent, setIntent] = useState<IntentData | null>(null);
  const { mutate: createIntent, isPending: creatingIntent } = useCreatePaymentIntent();

  useEffect(() => {
    if (tiers[0]?.months) setMonths(tiers[0].months);
  }, [course?._id, tiers.length]);

  if (isLoading && !course) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!course) {
    return <div className="p-8 text-center">Course not found</div>;
  }

  if (!isStripeConfigured()) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <p className="text-foreground font-semibold mb-2">Stripe is not configured</p>
        <p className="text-sm text-foreground/60 mb-4">
          Set a valid <code className="text-xs">VITE_STRIPE_PUBLISHABLE_KEY</code> (pk_test_… or pk_live_…) in your
          .env file, then restart the dev server.
        </p>
        <button onClick={() => navigate(-1)} className="text-primary font-semibold text-sm">
          Go back
        </button>
      </div>
    );
  }

  const selectedTier = tiers.find((t: any) => t.months === months) || tiers[0];
  const amountLabel = selectedTier ? formatPrice(selectedTier.price, selectedTier.currency) : "";

  const startPayment = () => {
    if (!selectedTier) return;
    setIntent(null);
    createIntent(
      { courseId: id, months },
      {
        onSuccess: (res: any) => {
          const data = res?.data;
          if (data?.clientSecret) {
            setIntent({
              clientSecret: data.clientSecret,
              paymentIntentId: data.paymentIntentId,
            });
          } else {
            toast.error("Could not start payment. Please try again.");
          }
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Checkout"
        subtitle={`Enrolling in ${course.title}`}
        onBack={() => navigate(`/course-detail/${id}`, { replace: true })}
        badge="Secure Payment"
      />
      <div className="max-w-5xl mx-auto p-5 lg:p-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {!intent ? (
              <>
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h2 className="font-bold text-foreground mb-1">Select access plan</h2>
                  <p className="text-xs text-foreground/50 mb-4">Choose how long you want access to this course</p>
                  {tiers.length === 0 ? (
                    <p className="text-sm text-foreground/60 py-4">
                      No purchase plans are available for this course right now. Please contact support.
                    </p>
                  ) : (
                  <div className="space-y-3">
                    {tiers.map((tier: any) => (
                      <label
                        key={tier.months}
                        className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                          months === tier.months ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="plan"
                          checked={months === tier.months}
                          onChange={() => setMonths(tier.months)}
                        />
                        <CreditCard size={18} className="text-foreground/60" />
                        <div className="flex-1">
                          <span className="text-sm font-semibold block">{tier.months} month(s) full access</span>
                          <span className="text-xs text-foreground/50">All lessons · Progress tracking</span>
                        </div>
                        <span className="font-bold text-primary text-lg">
                          {formatPrice(tier.price, tier.currency)}
                        </span>
                      </label>
                    ))}
                  </div>
                  )}
                </div>
                <button
                  disabled={creatingIntent || !selectedTier}
                  onClick={startPayment}
                  className="w-full gradient-warm text-accent-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                >
                  {creatingIntent ? <Loader2 className="animate-spin" size={18} /> : null}
                  Continue to payment
                </button>
              </>
            ) : (
              <Elements
                key={intent.clientSecret}
                stripe={stripePromise}
                options={{
                  clientSecret: intent.clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: { colorPrimary: "#0d9488", borderRadius: "12px" },
                  },
                }}
              >
                <StripePaymentForm
                  courseId={id}
                  amountLabel={amountLabel}
                  onBack={() => setIntent(null)}
                  onSuccess={() => navigate(`/payment/success?courseId=${id}`)}
                />
              </Elements>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 h-fit space-y-4">
            <h2 className="font-bold text-foreground">Order summary</h2>
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <img src={course.thumbnail} alt={course.title} className="w-16 h-16 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground line-clamp-2">{course.title}</p>
                <p className="text-xs text-foreground/50 mt-0.5">
                  {course.totalLessons} lessons · {formatDuration(course.totalDuration)}
                </p>
              </div>
            </div>
            {selectedTier && (
              <div className="text-sm space-y-2">
                <div className="flex justify-between text-foreground/70">
                  <span>{selectedTier.months} month(s) access</span>
                  <span>{amountLabel}</span>
                </div>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-foreground pt-3 border-t border-border text-lg">
              <span>Total</span>
              <span className="text-primary">{amountLabel || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/50 pt-2">
              <ShieldCheck size={14} className="text-success shrink-0" />
              <span>
                {selectedTier?.months || months} month(s) access from purchase · Secure streaming
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentScreen;
