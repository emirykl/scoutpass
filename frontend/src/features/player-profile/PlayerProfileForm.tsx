import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  playerProfileSchema,
  type PlayerProfile,
  type PositionGroup,
  type PositionMetrics
} from "@scoutpass/backend/contracts";

interface PlayerProfileFormProps {
  readonly value: PlayerProfile;
  readonly onChange: (profile: PlayerProfile) => void;
  readonly onLoadDemo: () => void;
}

export function PlayerProfileForm({ value, onChange, onLoadDemo }: PlayerProfileFormProps) {
  const [draftSavedAt, setDraftSavedAt] = useState<string | undefined>();
  const { register, reset, setValue, getValues, control } = useForm<PlayerProfile>({
    defaultValues: value,
    mode: "onChange"
  });
  const watchedProfile = useWatch({ control }) as PlayerProfile;
  const parsed = playerProfileSchema.safeParse(watchedProfile);
  const watchedProfileSnapshot = JSON.stringify(watchedProfile);
  const positionGroup = watchedProfile.football?.positionGroup ?? "forward";
  const completion = calculateCompletion(watchedProfile);

  useEffect(() => {
    reset(value);
  }, [reset, value]);

  useEffect(() => {
    const result = playerProfileSchema.safeParse(JSON.parse(watchedProfileSnapshot));
    if (result.success) {
      onChange(result.data);
    }
  }, [onChange, watchedProfileSnapshot]);

  useEffect(() => {
    const currentGroup = getValues("performance.positionSpecific.positionGroup");
    if (currentGroup !== positionGroup) {
      setValue("performance.positionSpecific", createDefaultPositionMetrics(positionGroup));
    }
  }, [getValues, positionGroup, setValue]);

  const saveDraft = () => {
    if (!parsed.success) {
      return;
    }
    localStorage.setItem("scoutpass.playerDraft", JSON.stringify(parsed.data));
    setDraftSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <section className="panel" aria-labelledby="profile-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Player workspace</p>
          <h2 id="profile-title">Profile editor</h2>
        </div>
        <button type="button" className="secondary-button" onClick={onLoadDemo}>
          Load demo
        </button>
        <button type="button" className="secondary-button" onClick={saveDraft}>
          Save draft
        </button>
      </div>

      <div className="completion">
        <span style={{ width: `${completion}%` }} />
      </div>
      <p className="muted">{completion}% profile completion · self-entered data, not verified</p>
      {draftSavedAt ? <p className="muted">Draft saved locally at {draftSavedAt}</p> : null}

      <form className="form-grid">
        <label>
          Full name
          <input {...register("football.fullName")} />
        </label>
        <label>
          Age
          <input type="number" {...register("football.age", { valueAsNumber: true })} />
        </label>
        <label>
          Country
          <input {...register("football.country")} />
        </label>
        <label>
          City
          <input {...register("football.city")} />
        </label>
        <label>
          Current team
          <input {...register("football.currentTeam")} />
        </label>
        <label>
          Primary position
          <input {...register("football.primaryPosition")} />
        </label>
        <label>
          Position group
          <select {...register("football.positionGroup")}>
            <option value="goalkeeper">Goalkeeper</option>
            <option value="defender">Defender</option>
            <option value="midfielder">Midfielder</option>
            <option value="forward">Forward</option>
          </select>
        </label>
        <label>
          Dominant foot
          <select {...register("football.dominantFoot")}>
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label>
          Matches
          <input
            type="number"
            {...register("performance.common.matchesPlayed", { valueAsNumber: true })}
          />
        </label>
        <label>
          Minutes
          <input
            type="number"
            {...register("performance.common.minutesPlayed", { valueAsNumber: true })}
          />
        </label>
        <label>
          Goals
          <input type="number" {...register("performance.common.goals", { valueAsNumber: true })} />
        </label>
        <label>
          Assists
          <input
            type="number"
            {...register("performance.common.assists", { valueAsNumber: true })}
          />
        </label>

        {positionGroup === "goalkeeper" ? (
          <>
            <label>
              Saves
              <input
                type="number"
                {...register("performance.positionSpecific.saves", { valueAsNumber: true })}
              />
            </label>
            <label>
              Save %
              <input
                type="number"
                {...register("performance.positionSpecific.savePercentage", {
                  valueAsNumber: true
                })}
              />
            </label>
          </>
        ) : null}

        {positionGroup === "forward" ? (
          <>
            <label>
              Shots
              <input
                type="number"
                {...register("performance.positionSpecific.shots", { valueAsNumber: true })}
              />
            </label>
            <label>
              Successful dribbles / match
              <input
                type="number"
                step="0.1"
                {...register("performance.positionSpecific.successfulDribblesPerMatch", {
                  valueAsNumber: true
                })}
              />
            </label>
          </>
        ) : null}

        {positionGroup === "defender" ? (
          <>
            <label>
              Clearances / match
              <input
                type="number"
                step="0.1"
                {...register("performance.positionSpecific.clearancesPerMatch", {
                  valueAsNumber: true
                })}
              />
            </label>
            <label>
              Aerial duels won %
              <input
                type="number"
                {...register("performance.positionSpecific.aerialDuelsWonPercentage", {
                  valueAsNumber: true
                })}
              />
            </label>
          </>
        ) : null}

        {positionGroup === "midfielder" ? (
          <>
            <label>
              Key passes / match
              <input
                type="number"
                step="0.1"
                {...register("performance.positionSpecific.keyPassesPerMatch", {
                  valueAsNumber: true
                })}
              />
            </label>
            <label>
              Chances created
              <input
                type="number"
                {...register("performance.positionSpecific.chancesCreated", {
                  valueAsNumber: true
                })}
              />
            </label>
          </>
        ) : null}

        <label className="wide">
          Strongest qualities
          <textarea rows={3} {...register("qualitative.strongestQualities")} />
        </label>
        <label className="wide">
          Development goals
          <textarea rows={3} {...register("qualitative.developmentGoals")} />
        </label>
        <label className="wide">
          Coach feedback
          <textarea rows={3} {...register("qualitative.coachFeedback")} />
        </label>
      </form>
      {!parsed.success ? <p className="error">Profile draft is incomplete or invalid.</p> : null}
    </section>
  );
}

const calculateCompletion = (profile: PlayerProfile): number => {
  const fields = [
    profile.football.fullName,
    profile.football.country,
    profile.football.city,
    profile.football.currentTeam,
    profile.football.primaryPosition,
    profile.football.preferredPlayingStyle,
    profile.football.careerObjective,
    profile.qualitative.strongestQualities,
    profile.qualitative.developmentGoals,
    profile.qualitative.coachFeedback,
    profile.qualitative.personalStatement
  ];
  const complete = fields.filter((field) => field.trim().length > 0).length;
  return Math.round((complete / fields.length) * 100);
};

const createDefaultPositionMetrics = (positionGroup: PositionGroup): PositionMetrics => {
  switch (positionGroup) {
    case "goalkeeper":
      return {
        positionGroup,
        saves: 0,
        savePercentage: 0,
        cleanSheets: 0,
        crossesClaimed: 0,
        distributionAccuracy: 0
      };
    case "defender":
      return {
        positionGroup,
        tacklesPerMatch: 0,
        interceptionsPerMatch: 0,
        clearancesPerMatch: 0,
        aerialDuelsWonPercentage: 0,
        passingAccuracy: 0
      };
    case "midfielder":
      return {
        positionGroup,
        passCompletionPercentage: 0,
        keyPassesPerMatch: 0,
        assists: 0,
        ballRecoveriesPerMatch: 0,
        chancesCreated: 0
      };
    case "forward":
      return {
        positionGroup,
        goals: 0,
        shots: 0,
        shotsOnTarget: 0,
        assists: 0,
        successfulDribblesPerMatch: 0
      };
  }
};
