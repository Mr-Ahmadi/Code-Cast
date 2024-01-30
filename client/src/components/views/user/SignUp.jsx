import useForm from "../../../hooks/useForm";
import { Link, /*useLocation, useNavigate*/ } from "react-router-dom";
import { useState } from "react";
import signUp from "../../../functions/requests/signUp";

const SignUp = () => {
    // const navigate = useNavigate()
    // const location = useLocation()
    const [requesting] = useState(false);
    const {
        values, message,
        handleChange,
        handleSubmit,
        handleReset,
    } = useForm({
        email: "",
        password: "",
        repeatPassword: "",
    }, signUp);

    return (
        <div className="form-container">
            <h2 className="form-title">Sign Up</h2>
            <form onSubmit={handleSubmit} onReset={handleReset}>
                <div className="form-group">
                    <label htmlFor="email">
                        Email
                    </label>
                    <input
                        type="email"
                        className="text-input"
                        name="email"
                        value={values.email}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">
                        Password
                    </label>
                    <input className="text-input"
                        type="password"
                        name="password"
                        value={values.password}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="repeatPassword">
                        Repeat Password
                    </label>
                    <input className="text-input"
                        type="password"
                        name="repeatPassword"
                        value={values.repeatPassword}
                        onChange={handleChange}
                    />
                </div>
                {console.log(message)}
                {message.error !== ""
                    ? <span className="error-output">{message.error}</span>
                    : message.success !== ""
                        ? <span className="error-output">{message.success}</span>
                        : <span className="error-output">.</span>}
                <div className="bottom-row">
                    <div>
                        <Link to="/signin">Sign In</Link>
                    </div>
                    <div>
                        <input className="btn-primary"
                            type="reset" value="Clear"
                            disabled={requesting}
                        />
                        <input className="btn-primary"
                            type="submit" value="Sign Up"
                            disabled={requesting}
                        />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default SignUp;