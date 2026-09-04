import axios from "axios";
import cookies from "js-cookie";
import { getAuthToken, clearAuthToken } from "../../services/serverConfig";

const checkAuth = async (setAuth, setUser) => {
  // Either credential is enough: a cookie when the API shares this origin, a
  // stored bearer token when it does not.
  if (cookies.get("jwt") || getAuthToken()) {
    let config = {
      method: "get",
      url: "user/checkAuth",
      withCredentials: true,
    };

    axios
      .request(config)
      .then(({ status, data }) => {
        if (status === 200) {
          setAuth(true);
          setUser(data);
        } else {
          setAuth(false);
        }
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401) {
          clearAuthToken();
          setAuth(false);
        } else {
          // No response at all means the endpoint is unreachable, which is a
          // connection problem rather than a rejected credential.
          setAuth(undefined);
        }
      });
  } else setAuth(false);
};

export default checkAuth;
