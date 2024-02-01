import axios from "axios";
import checkEmail from "../validation/checkEmail";
import checkPassword from "../validation/checkPassword";

const signUp = async (values, setMessage, navigate) => {
  setMessage(["LOADING", null]);

  if (checkEmail(values.email)) {
    setMessage(["ERROR", checkEmail(values.email)]);
  } else if (checkPassword(values.password)) {
    setMessage(["ERROR", checkPassword(values.password)]);
  } else if (!values.repeatPassword) {
    setMessage(["ERROR", "Please repeat your password"]);
  } else if (values.repeatPassword !== values.password) {
    setMessage(["ERROR", "Passwords do not match"]);
  } else {
    let data = JSON.stringify({
      email: values.email,
      password: values.password,
    });

    let config = {
      method: "post",
      url: "http://localhost:4000/user/signup",
      headers: {
        "Content-Type": "application/json",
      },
      data,
      withCredentials: true,
    };

    axios
      .request(config)
      .then(({ data: { message }, status }) => {
        if (status === 201) {
          setMessage(["SUCCESS", "done!"]);
          navigate("/signin", { state: { message: ["SUCCESS", message] } });
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
