import { describeServerUrl } from "../../services/serverConfig";

/**
 * Turn an axios failure into something a user can act on.
 *
 * Axios reports every unreachable host as a bare "Network Error", which is
 * the single most likely failure once endpoints are user-editable — so name
 * the endpoint that failed instead.
 */
export default function describeRequestError(err) {
  const serverMessage = err?.response?.data?.message;
  if (serverMessage) return serverMessage;

  const status = err?.response?.status;
  if (status) return `Server error (${status})`;

  if (err?.code === "ECONNABORTED") {
    return `The server at ${describeServerUrl()} timed out.`;
  }

  if (err?.request) {
    return `Could not reach the server at ${describeServerUrl()}. Check the endpoint in Server Settings.`;
  }

  return err?.message || "Something went wrong.";
}
