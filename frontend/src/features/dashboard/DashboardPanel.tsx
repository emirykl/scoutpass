import type {
  PaymentReference,
  PlayerProfile,
  ScoutPassEvent,
  ScoutReport,
  SharedPlayerPackage,
  TryoutInvitation
} from "@scoutpass/backend/contracts";

interface DashboardPanelProps {
  readonly role: "player" | "scout";
  readonly player: PlayerProfile;
  readonly report: ScoutReport;
  readonly receivedPackage?: SharedPlayerPackage | undefined;
  readonly invitation?: TryoutInvitation | undefined;
  readonly payment?: PaymentReference | undefined;
  readonly connectionStatus: string;
  readonly activityEvents: readonly ScoutPassEvent[];
  readonly onNavigate: (step: string) => void;
}

export function DashboardPanel({
  role,
  player,
  report,
  receivedPackage,
  invitation,
  payment,
  connectionStatus,
  activityEvents,
  onNavigate
}: DashboardPanelProps) {
  const playerCompletion = profileCompletion(player);
  const summaries =
    role === "player"
      ? [
          {
            label: "Profile",
            value: `${playerCompletion}% complete`,
            detail: player.football.primaryPosition,
            step: "profile"
          },
          {
            label: "Local report",
            value: report.modelInfo.includes("pending") ? "Preview ready" : "Generated",
            detail: formatDate(report.generatedAt),
            step: "report"
          },
          {
            label: "Connection",
            value: humanize(connectionStatus),
            detail: "Direct Pears relationship",
            step: "connect"
          },
          {
            label: "Tryout",
            value: invitation ? humanize(invitation.status) : "None received",
            detail: invitation?.trialTitle ?? "Waiting for a scout invitation",
            step: "invite"
          },
          {
            label: "Travel support",
            value: payment ? humanize(payment.status) : "No transaction",
            detail: payment ? `${payment.amount} ${payment.asset}` : "Testnet only",
            step: "payment"
          }
        ]
      : [
          {
            label: "Connection",
            value: humanize(connectionStatus),
            detail: "Direct Pears relationship",
            step: "connect"
          },
          {
            label: "Received player",
            value: receivedPackage ? "Profile received" : "No profile",
            detail: receivedPackage?.packageId ?? "Waiting for approved player data",
            step: "player"
          },
          {
            label: "Tryout",
            value: invitation ? humanize(invitation.status) : "Not prepared",
            detail: invitation?.trialTitle ?? "No invitation in progress",
            step: "invite"
          },
          {
            label: "Travel support",
            value: payment ? humanize(payment.status) : "No transaction",
            detail: payment ? `${payment.amount} ${payment.asset}` : "Accepted invitations only",
            step: "payment"
          }
        ];

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{role === "player" ? "Player overview" : "Scout overview"}</p>
          <h2 id="dashboard-title">
            {role === "player" ? `Welcome, ${player.football.fullName}` : "Scouting desk"}
          </h2>
        </div>
        <span className={`connection-badge status-${connectionStatus}`}>
          Pears {humanize(connectionStatus)}
        </span>
      </div>

      <div className="summary-grid">
        {summaries.map((summary) => (
          <button
            type="button"
            className="summary-card"
            key={summary.label}
            onClick={() => onNavigate(summary.step)}
          >
            <span>{summary.label}</span>
            <strong>{summary.value}</strong>
            <small>{summary.detail}</small>
          </button>
        ))}
      </div>

      <ActivityTimeline events={activityEvents} />
    </section>
  );
}

function ActivityTimeline({ events }: { readonly events: readonly ScoutPassEvent[] }) {
  const ordered = [...events]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8);
  return (
    <section className="activity-section" aria-labelledby="activity-title">
      <h3 id="activity-title">Recent activity</h3>
      {ordered.length === 0 ? (
        <p className="summary">Connection activity will appear here.</p>
      ) : (
        <ol className="activity-timeline">
          {ordered.map((event) => (
            <li key={event.id}>
              <span className="timeline-marker" />
              <div>
                <strong>{EVENT_LABELS[event.type]}</strong>
                <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const EVENT_LABELS: Record<ScoutPassEvent["type"], string> = {
  "player.profile_shared": "Player profile shared",
  "profile.received": "Player profile received",
  "tryout.invitation": "Tryout invitation sent",
  "invitation.response": "Invitation response received",
  "wallet.address_shared": "Player receive address shared",
  "travel_support.proposed": "Travel support reviewed",
  "travel_support.sent": "Travel support transaction updated"
};

const profileCompletion = (profile: PlayerProfile): number => {
  const values = [
    profile.football.fullName,
    profile.football.country,
    profile.football.city,
    profile.football.currentTeam,
    profile.football.primaryPosition,
    profile.football.preferredPlayingStyle,
    profile.football.careerObjective,
    profile.qualitative.strongestQualities,
    profile.qualitative.developmentGoals,
    profile.qualitative.personalStatement
  ];
  return Math.round(
    (values.filter((value) => value.trim().length > 0).length / values.length) * 100
  );
};

const humanize = (value: string): string => value.replaceAll("_", " ");
const formatDate = (value: string): string => new Date(value).toLocaleString();
