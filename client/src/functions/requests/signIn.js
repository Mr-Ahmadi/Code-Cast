import axios from "axios";
import checkEmail from "../validation/checkEmail";
import checkPassword from "../validation/checkPassword";

const signUp = async (values, setMessage, navigate) => {
  setMessage(["LOADING", null]);

  if (checkEmail(values.email)) {
    setMessage(["ERROR", checkEmail(values.email)]);
  } else if (checkPassword(values.password)) {
    setMessage(["ERROR", checkPassword(values.password)]);
  } else {
    let data = JSON.stringify({
      email: values.email,
      password: values.password,
    });

    let config = {
      method: "post",
      url: "http://localhost:4000/user/signin",
      headers: {
        "Content-Type": "application/json",
      },
      data,
      withCredentials: true,
    };

    axios
      .request(config)
      .then(({ data: { message }, status }) => {
        if (status === 200) {
          navigate("/", { state: { message: ["SUCCESS", message] } });
        } else {
          setMessage(["ERROR", message]);
        }
      })
      .catch((err) => {
        setMessage(["ERROR", err.message]);
      });
  }
};

export default signUp;
