import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import Home2Page from "../Home2/Home2Page";
import { HOME2_SECTIONS, Home2SectionId } from "../../home/home2Tasks";
import { Session, SummaryLayout } from "../../types";

const INDUSTRIES = ["Sportswear & Footwear", "Beauty & Personal Care", "Consumer Electronics", "Home & Lifestyle", "Food & Beverage"];
const ONBOARDING_SECTION_ID: Home2SectionId = "competitor-intelligence";
const ONBOARDING_TASKS = HOME2_SECTIONS.find((section) => section.id === ONBOARDING_SECTION_ID)?.tasks.slice(0, 3) ?? [];
const ONBOARDING_STEP_COUNT = ONBOARDING_TASKS.length + 1;

interface OnboardingPageProps {
	sessions: Session[];
	onRunTask: (
		sectionId: Home2SectionId,
		taskIndex: number,
		prompt: string,
		taskId?: string,
		summaryLayout?: SummaryLayout,
		sourceSessionId?: string
	) => Promise<string | null> | string | null | void;
	onSessionSelect: (sessionId: string) => void;
	onConnectRequiredIntegration?: (sessionId: string, integrationId: string) => Promise<void> | void;
	onOpenBrandContext: () => void;
	onConnectSlack?: () => Promise<void> | void;
	onComplete: () => void;
	activeBrand: string;
	isBrandGuidelinesConnected?: boolean;
}

const isCompletedTaskSession = (session: Session | undefined) => Boolean(session?.status === "completed" && session.summary);

const OnboardingPage: React.FC<OnboardingPageProps> = ({
	sessions,
	onRunTask,
	onSessionSelect,
	onConnectRequiredIntegration,
	onOpenBrandContext,
	onConnectSlack,
	onComplete,
	activeBrand,
	isBrandGuidelinesConnected = false,
}) => {
	const [brandName, setBrandName] = useState("NIKE");
	const [websiteUrl, setWebsiteUrl] = useState("https://www.nike.com");
	const [industry, setIndustry] = useState(INDUSTRIES[0]);
	const [phase, setPhase] = useState<"setup" | "run">("setup");
	const [activeTaskIndex, setActiveTaskIndex] = useState(0);
	const [sessionIdsByTask, setSessionIdsByTask] = useState<Record<number, string>>({});
	const [isStartingTask, setIsStartingTask] = useState(false);
	const [slackConnectionStatus, setSlackConnectionStatus] = useState<"idle" | "connecting" | "connected">("idle");

	const taskSessions = useMemo(
		() => ONBOARDING_TASKS.map((_, index) => sessions.find((session) => session.id === sessionIdsByTask[index])),
		[sessions, sessionIdsByTask]
	);
	const currentSession = taskSessions[activeTaskIndex];
	const currentSessionId = sessionIdsByTask[activeTaskIndex] ?? null;
	const currentTaskComplete = isCompletedTaskSession(currentSession);
	const hasStartedTaskFlow = Object.keys(sessionIdsByTask).length > 0;
	const completedTaskCount = useMemo(() => {
		let completedCount = 0;
		for (let index = 0; index < ONBOARDING_TASKS.length; index += 1) {
			if (!isCompletedTaskSession(taskSessions[index])) {
				break;
			}
			completedCount += 1;
		}
		return completedCount;
	}, [taskSessions]);
	const currentStepIndex = phase === "setup" ? 0 : activeTaskIndex + 1;
	const completedStepCount = hasStartedTaskFlow || phase === "run" ? 1 + completedTaskCount : 0;

	const handleRunOnboardingTask = async (
		sectionId: Home2SectionId,
		taskIndex: number,
		prompt: string,
		taskId?: string,
		summaryLayout?: SummaryLayout,
		sourceSessionId?: string
	) => {
		setPhase("run");
		setActiveTaskIndex(taskIndex);
		setIsStartingTask(true);

		try {
			const nextSessionId = await Promise.resolve(onRunTask(sectionId, taskIndex, prompt, taskId, summaryLayout, sourceSessionId));
			if (nextSessionId) {
				setSessionIdsByTask((currentSessionIds) => ({
					...currentSessionIds,
					[taskIndex]: nextSessionId,
				}));
			}
			return nextSessionId ?? null;
		} finally {
			setIsStartingTask(false);
		}
	};

	const renderSingleTaskCard = (taskIndex: number, sessionId?: string | null) => {
		const sourceSessionId = taskIndex > 0 ? sessionIdsByTask[taskIndex - 1] : undefined;

		return (
			<Home2Page
				sessions={sessions}
				onRunTask={handleRunOnboardingTask}
				onRunComposerMessage={() => undefined}
				onSessionSelect={onSessionSelect}
				onConnectRequiredIntegration={onConnectRequiredIntegration}
				onOpenBrandContext={onOpenBrandContext}
				activeBrand={activeBrand}
				isBrandGuidelinesConnected={isBrandGuidelinesConnected}
				surface="home3"
				layout="tabs"
				singleTaskMode={{
					sectionId: ONBOARDING_SECTION_ID,
					taskIndex,
					sessionId,
					sourceSessionId,
				}}
			/>
		);
	};

	const renderStartingCard = () => (
		<article className="home2-run-card is-running onboarding-starting-card">
			<div className="home2-run-header">
				<div>
					<h3>{ONBOARDING_TASKS[activeTaskIndex]?.title ?? "Starting task"}</h3>
				</div>
			</div>
			<div className="home2-running-feed" aria-label="Starting task">
				<div className="home2-running-feed-item">
					<span>Update</span>
					<p>Starting the agent run and opening a live stream...</p>
				</div>
			</div>
		</article>
	);

	const handleConnectSlack = async () => {
		if (slackConnectionStatus !== "idle") {
			return;
		}

		setSlackConnectionStatus("connecting");
		await Promise.resolve(onConnectSlack?.());
		setSlackConnectionStatus("connected");
		window.setTimeout(onComplete, 1300);
	};

	const goToStep = (stepIndex: number) => {
		if (stepIndex === 0) {
			setPhase("setup");
			return;
		}

		setPhase("run");
		setActiveTaskIndex(stepIndex - 1);
	};

	const renderSimpleNextButton = (nextTaskIndex = 0) => (
		<button type="button" className="onboarding-simple-next-btn" onClick={() => goToStep(nextTaskIndex + 1)}>
			<span>Next</span>
			<ArrowRight size={16} />
		</button>
	);

	const renderStepper = () => (
		<div className="onboarding-stepper" aria-label="Onboarding progress">
			{Array.from({ length: ONBOARDING_STEP_COUNT }, (_, stepIndex) => {
				const canOpenStep = stepIndex < currentStepIndex && stepIndex < completedStepCount;
				const isCurrentStep = stepIndex === currentStepIndex;
				const isCompletedStep = stepIndex < completedStepCount && !isCurrentStep;

				return (
					<button
						key={`onboarding-step-${stepIndex}`}
						type="button"
						className={`onboarding-step-dot ${isCompletedStep ? "is-complete" : ""} ${isCurrentStep ? "is-active" : ""} ${
							canOpenStep ? "is-clickable" : ""
						}`}
						disabled={!canOpenStep}
						aria-label={stepIndex === 0 ? "Go back to brand setup" : `Go back to onboarding task ${stepIndex}`}
						onClick={() => goToStep(stepIndex)}
					/>
				);
			})}
		</div>
	);

	const renderSlackCompletionCard = () => (
		<div className={`onboarding-complete-card is-${slackConnectionStatus}`}>
			<span className="onboarding-complete-icon" aria-hidden="true">
				{slackConnectionStatus === "connected" ? <CheckCircle2 size={22} /> : <MessageSquare size={22} />}
			</span>
			<div className="onboarding-complete-copy">
				<span>Setup complete</span>
				<h2>{slackConnectionStatus === "connected" ? "Slack connected" : "Bring Raya into your team flow"}</h2>
				<p>
					{slackConnectionStatus === "connected"
						? "Raya is connected to your Slack workspace. Opening your Home-3 workspace now."
						: "Connect Raya to your Slack workspace so insights and inspirations can be delivered straight to where your team already works."}
				</p>
			</div>
			<button
				type="button"
				className="onboarding-slack-cta"
				disabled={slackConnectionStatus !== "idle"}
				onClick={handleConnectSlack}
			>
				{slackConnectionStatus === "connecting" ? (
					<>
						<Loader2 size={16} />
						Connecting
					</>
				) : slackConnectionStatus === "connected" ? (
					<>
						<CheckCircle2 size={16} />
						Connected
					</>
				) : (
					"Connect to Slack"
				)}
			</button>
		</div>
	);

	const renderSetupScreen = () => (
		<div className="onboarding-panel">
			{renderStepper()}
			<div className="onboarding-heading">
				<span>Raya onboarding</span>
				<h1>Set up your brand workspace</h1>
				<p>Start with brand context, then unlock the first competitor intelligence deliverable.</p>
			</div>

			<div className="onboarding-form-grid">
				<label>
					<span>Brand name</span>
					<input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
				</label>
				<label>
					<span>Brand website URL</span>
					<input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
				</label>
				<label>
					<span>Industry</span>
					<select value={industry} onChange={(event) => setIndustry(event.target.value)}>
						{INDUSTRIES.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
				</label>
			</div>

			<div className="onboarding-first-task">{hasStartedTaskFlow ? renderSimpleNextButton(0) : renderSingleTaskCard(0)}</div>
		</div>
	);

	const renderRunScreen = () => {
		const nextTaskIndex = activeTaskIndex + 1;
		const hasNextTask = nextTaskIndex < ONBOARDING_TASKS.length;
		const hasStartedNextTask = hasNextTask && Boolean(sessionIdsByTask[nextTaskIndex]);
		const shouldShowSimpleNextButton = currentTaskComplete && hasStartedNextTask;

		return (
			<div className="onboarding-panel onboarding-run-panel">
				{renderStepper()}

				<div className="onboarding-heading">
					<span>Competitor Intelligence</span>
					<h1>{currentTaskComplete ? "Your next deliverable is ready" : "Raya is preparing your summary"}</h1>
					<p>
						{currentTaskComplete
							? "Continue the sequence to build a stronger creative starting point."
							: "This is a live agent run, so the card below will update as the plan progresses."}
					</p>
				</div>

				{isStartingTask && !currentSessionId ? renderStartingCard() : renderSingleTaskCard(activeTaskIndex, currentSessionId)}

				{currentTaskComplete && hasNextTask && (
					<div className="onboarding-next-task">
						{shouldShowSimpleNextButton ? (
							renderSimpleNextButton(nextTaskIndex)
						) : (
							renderSingleTaskCard(nextTaskIndex)
						)}
					</div>
				)}

				{currentTaskComplete && !hasNextTask && (
					<div className="onboarding-next-task onboarding-complete-task">
						{renderSlackCompletionCard()}
					</div>
				)}
			</div>
		);
	};

	return (
		<main className="onboarding-page">
			<button type="button" className="onboarding-skip-btn" onClick={onComplete}>
				Skip
			</button>
			<div className={`onboarding-shell ${phase === "setup" ? "is-setup" : "is-run"}`}>
				{phase === "setup" ? renderSetupScreen() : renderRunScreen()}
			</div>
		</main>
	);
};

export default OnboardingPage;
