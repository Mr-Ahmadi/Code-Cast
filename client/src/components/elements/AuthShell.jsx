import { useState } from 'react';
import PropTypes from 'prop-types';
import { FiServer, FiChevronDown } from 'react-icons/fi';
import ServerSettings from './ServerSettings';
import { getServerUrl, describeServerUrl } from '../../services/serverConfig';
import Logo from './Logo';

/**
 * Frame shared by the sign-in and sign-up screens.
 *
 * The endpoint editor lives here because it is unreachable from the in-app
 * Settings dialog until someone is signed in — and pointing the app at the
 * right server is a prerequisite for signing in at all.
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  const [showServer, setShowServer] = useState(false);
  const [endpoint, setEndpoint] = useState(getServerUrl);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={44} />
          <div className="auth-brand-text">
            <span className="auth-brand-name">Code Cast</span>
            <span className="auth-brand-tagline">Record and replay code, with your voice</span>
          </div>
        </div>

        <h2 className="auth-title">{title}</h2>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}

        {children}

        {footer}

        <div className="auth-server">
          <button
            type="button"
            className={'auth-server-toggle' + (showServer ? ' open' : '')}
            onClick={() => setShowServer((v) => !v)}
            aria-expanded={showServer}
          >
            <FiServer size={13} />
            <span className="auth-server-label">Server</span>
            <span className="auth-server-value" title={describeServerUrl(endpoint)}>
              {describeServerUrl(endpoint)}
            </span>
            <FiChevronDown size={13} className="auth-server-chevron" />
          </button>
          {showServer && (
            <div className="auth-server-body">
              <ServerSettings compact onApplied={setEndpoint} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

AuthShell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  footer: PropTypes.node,
};
