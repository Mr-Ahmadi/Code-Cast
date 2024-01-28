import useForm from "../../../hooks/useForm";
// import FormContainer from "../../Elements/FormContainer";
// import FormGroup from "../../Elements/FormGroup";
// import Title from "../../Elements/Title";
// import Button from "../../Elements/Button";
// import Error from "../../Elements/Error";
// import Input from "../../Elements/Input";
// import Label from "../../Elements/Label";
// import Row from "../../Elements/Row";
import checkEmail from "../../../functions/validation/checkEmail";
import checkPassword from "../../../functions/validation/checkPassword";

// A function to check the validity of the form inputs
const validate = (values) => {
    let errors = {};

    // Email validation
    if (!values.email) {
        errors.email = "Email is required";
    } else if (!checkEmail(values.email)) {
        errors.email = "Email is invalid";
    }

    // Password validation
    if (!values.password) {
        errors.password = "Password is required";
    } else if (!checkPassword(values.password).validation) {
        errors.password = checkPassword(values.password).message;
    }

    // Repeat password validation
    if (!values.repeatPassword) {
        errors.repeatPassword = "Please repeat your password";
    } else if (values.repeatPassword !== values.password) {
        errors.repeatPassword = "Passwords do not match";
    }

    return errors;
};

// The main component that renders the sign up form
const SignUp = () => {
    const { handleChange, handleSubmit, handleReset, values, errors } = useForm({
        email: "",
        password: "",
        repeatPassword: "",
    }, validate);

    return (
        <div className="form-container">
            <h2 className="form-title">Sign Up</h2>
            <form onSubmit={handleSubmit} onReset={handleReset}>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        className="text-input"
                        name="email"
                        value={values.email}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        className="text-input"
                        name="password"
                        value={values.password}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="repeatPassword">Repeat Password</label>
                    <input
                        type="password"
                        className="text-input"
                        name="repeatPassword"
                        value={values.repeatPassword}
                        onChange={handleChange}
                    />
                </div>
                {errors.email
                    ? <span className="error-output">{errors.email}</span>
                    : errors.password
                        ? <span className="error-output">{errors.password}</span>
                        : errors.repeatPassword
                            ? <span className="error-output">{errors.repeatPassword}</span>
                            : <span className="error-output">.</span>}
                <div className="bottom-row">
                    <div>
                        <a href="/" style={{ "marginLeft": "auto", "marginRight": 0 }}>Sign In</a>
                    </div>
                    <div>
                        <input className="btn-primary" type="reset" value={"Clear"} />
                        <input className="btn-primary" type="submit" value={"Sign In"} />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default SignUp;