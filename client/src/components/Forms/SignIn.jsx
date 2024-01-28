import useForm from "../../hooks/useForm";
import FormContainer from "./Elements/FormContainer";
import FormGroup from "./Elements/FormGroup";
import Title from "./Elements/Title";
import Button from "./Elements/Button";
import Error from "./Elements/Error";
import Input from "./Elements/Input";
import Label from "./Elements/Label";
import Row from "./Elements/Row";

// A function to check the validity of the form inputs
const validate = (values) => {
    let errors = {};

    // Email validation
    if (!values.email) {
        errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
        errors.email = "Email is invalid";
    }

    // Password validation
    if (!values.password) {
        errors.password = "Password is required";
    } else if (values.password.length < 6) {
        errors.password = "Password must be at least 6 characters";
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
        <FormContainer>
            <Title>Sign Up</Title>
            <form onSubmit={handleSubmit} onReset={handleReset}>
                <FormGroup>
                    <Label htmlFor="email">Email</Label>
                    <Input
                        type="email"
                        id="email"
                        name="email"
                        value={values.email}
                        onChange={handleChange}
                    />
                </FormGroup>
                <FormGroup>
                    <Label htmlFor="password">Password</Label>
                    <Input
                        type="password"
                        id="password"
                        name="password"
                        value={values.password}
                        onChange={handleChange}
                    />
                </FormGroup>
                <FormGroup>
                    <Label htmlFor="repeatPassword">Repeat Password</Label>
                    <Input
                        type="password"
                        id="repeatPassword"
                        name="repeatPassword"
                        value={values.repeatPassword}
                        onChange={handleChange}
                    />
                </FormGroup>
                {errors.email
                    ? <Error>{errors.email}</Error>
                    : errors.password
                        ? <Error>{errors.password}</Error>
                        : errors.repeatPassword
                            ? <Error>{errors.repeatPassword}</Error>
                            : <Error>.</Error>}
                <Row>
                    <div>
                        <a href="/" style={{ "marginLeft": "auto", "marginRight": 0 }}>Sign In</a>
                    </div>
                    <div>
                        <Button type="reset" value={"Clear"} />
                        <Button type="submit" value={"Sign In"} />
                    </div>
                </Row>
            </form>
        </FormContainer>
    );
};

export default SignUp;