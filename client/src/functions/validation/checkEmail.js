const regex = (email) => {
  return email.match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/);
};

const checkEmail = (email) => {
  if (!email) {
    return "Email is required";
  } else if (!regex(email)) {
    return "Email is invalid";
  }

  return "";
};

export default checkEmail;
