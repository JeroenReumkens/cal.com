import { ArrowRightIcon } from "@heroicons/react/solid";
import { GetServerSidePropsContext } from "next";
import { useTranslation } from "next-i18next";
import Head from "next/head";

import classNames from "@calcom/lib/classNames";
import { User } from "@calcom/prisma/client";

import { getSession } from "@lib/auth";
import prisma from "@lib/prisma";

import { StepCard } from "./components/StepCard";
import { Steps } from "./components/Steps";
import { UserSettings } from "./components/UserSettings";

interface IOnboardingPageProps {
  user: User;
}

const OnboardingPage = (props: IOnboardingPageProps) => {
  const { user } = props;
  const { t } = useTranslation();
  const steps = ["user_settings", "connect_calendar", "setup_availability", "user_profile"];
  const currentStep = 0;
  const goToStep = () => {
    console.log("go to step");
  };
  return (
    <div className="dark:bg-brand dark:text-brand-contrast min-h-screen text-black" data-testid="onboarding">
      <Head>
        <title>Cal.com - {t("getting_started")}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="mx-auto px-4 py-24">
        <div className="relative">
          <div className="sm:mx-auto sm:w-full sm:max-w-lg">
            <header>
              <p className="font-cal mb-2 text-[28px] tracking-wider">{t("welcome_to_calcom")}!</p>
              <p className="text-sm font-normal text-gray-500">
                We just need some basic info to get your profile setup.
              </p>
              <p className="text-sm font-normal text-gray-500">You’ll be able to edit this later.</p>
            </header>
            <Steps maxSteps={steps.length} currentStep={currentStep} navigateToStep={goToStep} />
            <StepCard>{steps[currentStep] === "user_settings" && <UserSettings user={user} />}</StepCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const session = await getSession(context);

  if (!session?.user?.id) {
    return { redirect: { permanent: false, destination: "/auth/login" } };
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      bio: true,
      avatar: true,
      timeZone: true,
      weekStart: true,
      hideBranding: true,
      theme: true,
      plan: true,
      brandColor: true,
      darkBrandColor: true,
      metadata: true,
      timeFormat: true,
      allowDynamicBooking: true,
    },
  });

  if (!user) {
    throw new Error("User from session not found");
  }

  return {
    props: {
      user: user,
    },
  };
};

export default OnboardingPage;
