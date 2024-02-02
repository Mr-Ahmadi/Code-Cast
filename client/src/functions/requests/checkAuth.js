import axios from "axios";
import cookies from "js-cookie";

const checkAuth = async (setAuth, setVerified) => {
  if (cookies.get("jwt")) {
    let config = {
      method: "get",
      url: "user/checkAuth",
      // headers: {
      //   "Content-Type": "application/json",
      // },
      withCredentials: true,
    };

    axios
      .request(config)
      .then(({ status, data: { verified } }) => {
        if (status === 200) {
          setAuth(true);
          setVerified(verified);
        } else {
          setAuth(false);
        }
      })
      .catch(({ response: { status } }) => {
        if (status === 401) {
          setAuth(false);
        } else {
          setAuth(undefined);
        }
      });
  } else setAuth(false);
};

export default checkAuth;
