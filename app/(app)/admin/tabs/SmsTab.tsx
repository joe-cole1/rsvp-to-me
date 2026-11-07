"use client";
import { useTranslations } from "next-intl";

import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Field, Input, SecretInput } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";

export function SmsTab({
  config,
  handleToggleSmsEnabled,
  handleSaveSmsConfig,
  twilioAccountSid,
  setTwilioAccountSid,
  twilioAuthToken,
  setTwilioAuthToken,
  twilioPhoneNumber,
  setTwilioPhoneNumber,
  smsTestTo,
  setSmsTestTo,
  isPending,
  isTestingSms,
  handleTestSmsConfig,
}: {
  config: Record<string, string>;
  handleToggleSmsEnabled: () => void;
  handleSaveSmsConfig: (e: React.FormEvent) => void;
  twilioAccountSid: string;
  setTwilioAccountSid: React.Dispatch<React.SetStateAction<string>>;
  twilioAuthToken: string;
  setTwilioAuthToken: React.Dispatch<React.SetStateAction<string>>;
  twilioPhoneNumber: string;
  setTwilioPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  smsTestTo: string;
  setSmsTestTo: React.Dispatch<React.SetStateAction<string>>;
  isPending: boolean;
  isTestingSms: boolean;
  handleTestSmsConfig: () => Promise<void>;
}) {
  const tr = useTranslations("Ui.Admin");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Guest SMS Channel Toggle */}
      <div
        style={{
          ...appCardStyle,
          padding: "24px",
        }}
      >
        <Toggle
          theme={T}
          label={tr("smsNotifications")}
          description={tr("whenOnGuestsReceiveSmsConfirmationsBlastsRemindersAnd")}
          value={config.sms_enabled === "true"}
          onChange={handleToggleSmsEnabled}
          style={{ marginBottom: 0 }}
        />
      </div>

      <div
        style={{
          ...appCardStyle,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: APP_SHELL.textPrimary,
              margin: 0,
            }}
          >
            {tr("smsConfigurationTwilio")}
          </h3>
          <p style={{ color: APP_SHELL.textSecondary, fontSize: "13px", marginTop: "4px" }}>
            {tr("configureYourTwilioAccountToEnableSmsBlastsRsvp")}
          </p>
        </div>

        <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

        <form onSubmit={handleSaveSmsConfig} style={{ display: "flex", flexDirection: "column" }}>
          <Field theme={T} label={tr("twilioAccountSidTwilioAccountSid")}>
            <Input
              theme={T}
              type="text"
              placeholder={tr("eGAcxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")}
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
            />
          </Field>

          <Field theme={T} label={tr("twilioAuthTokenTwilioAuthToken")}>
            <SecretInput
              theme={T}
              showLabel={tr("showToken")}
              hideLabel={tr("hideToken")}
              placeholder={tr("twilioAuthenticationToken")}
              value={twilioAuthToken}
              onChange={(e) => setTwilioAuthToken(e.target.value)}
            />
          </Field>

          <Field theme={T} label={tr("twilioPhoneNumberTwilioPhoneNumber")}>
            <Input
              theme={T}
              type="text"
              placeholder={tr("eG1234567890")}
              value={twilioPhoneNumber}
              onChange={(e) => setTwilioPhoneNumber(e.target.value)}
            />
          </Field>

          <div
            style={{
              height: "1px",
              backgroundColor: APP_SHELL.navBorder,
              margin: "4px 0 20px",
            }}
          />

          {/* SMS Testing Panel */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "rgba(255,255,255,0.02)",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: APP_SHELL.textPrimary,
                margin: "0 0 6px 0",
              }}
            >
              {tr("testSmsConfiguration")}
            </h4>
            <p
              style={{
                fontSize: "13px",
                color: APP_SHELL.textSecondary,
                margin: "0 0 12px 0",
                lineHeight: "19px",
              }}
            >
              {tr("verifyYourTwilioConnectionBySendingATestSms")}
            </p>

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <Field
                theme={T}
                label={tr("testRecipientPhoneNumber")}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <Input
                  theme={T}
                  type="text"
                  placeholder={tr("eG15550199")}
                  value={smsTestTo}
                  onChange={(e) => setSmsTestTo(e.target.value)}
                />
              </Field>
              <Button
                theme={T}
                variant="secondary"
                type="button"
                disabled={isPending || isTestingSms}
                onClick={handleTestSmsConfig}
                style={{ whiteSpace: "nowrap" }}
              >
                {isTestingSms ? tr("sending") : tr("testConnection")}
              </Button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "20px",
            }}
          >
            <Button theme={T} variant="primary" type="submit" disabled={isPending || isTestingSms}>
              {tr("saveSettings")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
