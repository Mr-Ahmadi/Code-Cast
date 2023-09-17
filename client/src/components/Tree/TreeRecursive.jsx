import { v4 as uuidv4 } from "uuid";
import File from "./File";
import Folder from "./Folder";

const TreeRecursive = ({ data }) => {
    return data.map(item => {
        if (item.type === "file") {
            return <File name={item.name} key={uuidv4()} />;
        }
        if (item.type === "folder") {
            return (
                <Folder name={item.name} key={uuidv4()}>
                    <TreeRecursive data={item.childrens} key={uuidv4()} />
                </Folder>
            );
        }
    });
};

export default TreeRecursive