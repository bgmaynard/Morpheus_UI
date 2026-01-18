/**
 * Trading Controls Panel - Trading mode and profile management
 *
 * Critical safety controls:
 * - PAPER / LIVE mode toggle
 * - Live Trading Armed (requires confirmation)
 * - Kill Switch
 * - Profile selectors (gate, risk, guard)
 */

import { ComponentContainer } from 'golden-layout';
import { useState } from 'react';
import { useTrading, useProfile, useAppStore, ProfileLevel } from '../store/useAppStore';
import { getAPIClient, ProfilePayload } from '../morpheus/apiClient';
import './panels.css';

interface Props {
  container: ComponentContainer;
}

const PROFILE_OPTIONS: ProfileLevel[] = ['standard', 'permissive', 'strict'];

export function TradingControlsPanel({ container }: Props) {
  const trading = useTrading();
  const profile = useProfile();
  const addPendingCommand = useAppStore((s) => s.addPendingCommand);

  const [armConfirmation, setArmConfirmation] = useState('');
  const [showArmDialog, setShowArmDialog] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Arm live trading - requires typed confirmation
  const handleArmLive = async () => {
    if (armConfirmation !== 'ARM LIVE') {
      setMessage({ type: 'error', text: 'Type "ARM LIVE" to confirm' });
      return;
    }

    try {
      const client = getAPIClient();
      const result = await client.armLiveTrading(armConfirmation);

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'ARM_LIVE_TRADING',
        timestamp: Date.now(),
      });

      setShowArmDialog(false);
      setArmConfirmation('');
      setMessage({ type: 'success', text: 'Arming live trading...' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to arm live trading' });
    }
  };

  // Disarm live trading
  const handleDisarmLive = async () => {
    try {
      const client = getAPIClient();
      const result = await client.disarmLiveTrading();

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'DISARM_LIVE_TRADING',
        timestamp: Date.now(),
      });

      setMessage({ type: 'success', text: 'Disarming live trading...' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to disarm live trading' });
    }
  };

  // Activate kill switch
  const handleKillSwitch = async () => {
    try {
      const client = getAPIClient();
      const result = await client.activateKillSwitch();

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'ACTIVATE_KILL_SWITCH',
        timestamp: Date.now(),
      });

      setMessage({ type: 'success', text: 'Kill switch activated' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to activate kill switch' });
    }
  };

  // Deactivate kill switch
  const handleDeactivateKillSwitch = async () => {
    try {
      const client = getAPIClient();
      const result = await client.deactivateKillSwitch();

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'DEACTIVATE_KILL_SWITCH',
        timestamp: Date.now(),
      });

      setMessage({ type: 'success', text: 'Kill switch deactivated' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to deactivate kill switch' });
    }
  };

  // Update profile
  const handleProfileChange = async (
    field: keyof ProfilePayload,
    value: ProfileLevel
  ) => {
    const newProfile: ProfilePayload = {
      gate: field === 'gate' ? value : profile.gate,
      risk: field === 'risk' ? value : profile.risk,
      guard: field === 'guard' ? value : profile.guard,
    };

    try {
      const client = getAPIClient();
      const result = await client.setProfile(newProfile);

      addPendingCommand({
        command_id: result.command_id,
        command_type: 'SET_PROFILE',
        timestamp: Date.now(),
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    }
  };

  return (
    <div className="morpheus-panel">
      <div className="morpheus-panel-header">
        <span className="panel-title">Trading Controls</span>
      </div>
      <div className="morpheus-panel-content trading-controls">
        {/* Trading Mode Section */}
        <div className="control-section">
          <h4 className="section-title">Trading Mode</h4>
          <div className="mode-display">
            <span className={`trading-mode-large ${trading.mode.toLowerCase()}`}>
              {trading.mode}
            </span>
            {trading.mode === 'LIVE' && trading.liveArmed && (
              <span className="armed-badge">ARMED</span>
            )}
          </div>

          {/* Live Trading Controls */}
          {trading.mode === 'LIVE' && (
            <div className="live-controls">
              {!trading.liveArmed ? (
                <>
                  {!showArmDialog ? (
                    <button
                      className="btn btn-danger"
                      onClick={() => setShowArmDialog(true)}
                    >
                      Arm Live Trading
                    </button>
                  ) : (
                    <div className="arm-dialog">
                      <p className="warning-text">
                        Type "ARM LIVE" to enable live trading:
                      </p>
                      <input
                        type="text"
                        className="input arm-input"
                        value={armConfirmation}
                        onChange={(e) => setArmConfirmation(e.target.value.toUpperCase())}
                        placeholder="ARM LIVE"
                      />
                      <div className="arm-buttons">
                        <button className="btn btn-danger" onClick={handleArmLive}>
                          Confirm
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setShowArmDialog(false);
                            setArmConfirmation('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button className="btn" onClick={handleDisarmLive}>
                  Disarm Live Trading
                </button>
              )}
            </div>
          )}
        </div>

        {/* Kill Switch Section */}
        <div className="control-section">
          <h4 className="section-title">Kill Switch</h4>
          {!trading.killSwitchActive ? (
            <button className="btn btn-kill-switch" onClick={handleKillSwitch}>
              ACTIVATE KILL SWITCH
            </button>
          ) : (
            <div className="kill-switch-active-display">
              <span className="kill-switch-status">KILL SWITCH ACTIVE</span>
              <button className="btn btn-small" onClick={handleDeactivateKillSwitch}>
                Deactivate
              </button>
            </div>
          )}
        </div>

        {/* Profile Section */}
        <div className="control-section">
          <h4 className="section-title">Profiles</h4>
          <div className="profile-grid">
            <div className="profile-row">
              <label>Meta Gate</label>
              <select
                className="input"
                value={profile.gate}
                onChange={(e) => handleProfileChange('gate', e.target.value as ProfileLevel)}
              >
                {PROFILE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="profile-row">
              <label>Risk</label>
              <select
                className="input"
                value={profile.risk}
                onChange={(e) => handleProfileChange('risk', e.target.value as ProfileLevel)}
              >
                {PROFILE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="profile-row">
              <label>Exec Guard</label>
              <select
                className="input"
                value={profile.guard}
                onChange={(e) => handleProfileChange('guard', e.target.value as ProfileLevel)}
              >
                {PROFILE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`control-message ${message.type}`}>{message.text}</div>
        )}
      </div>
    </div>
  );
}
