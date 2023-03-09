import React from "react";
import { useState } from "react";
import FormDialog from "roamjs-components/components/FormDialog";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { mainDailyLog } from "./totalTime";

let title;
let resultsJSX;

const Dialog = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <FormDialog
        isOpen={isOpen}
        title={`${title}`}
        onClose={() => {
          setIsOpen(false);
        }}
        onSubmit={() => navigator.clipboard.writeText("test")}
        content={getTotalTimeHTMLTable()}
      />
    </>
  );
};

export function displayTotalTimesTable() {
  let resultJSX = getTotalTimeHTMLTable();

  renderOverlay({
    Overlay: Dialog,
  });
  // resultsJSX = getTotalTimeHTMLTable();
  let dialog = document.querySelector(
    ".bp3-dialog:not(.rm-modal-dialog--command-palette):not(.rm-extensions-marketplace-dialog)"
  );
  dialog.style.width = "auto";
  dialog.style.position = "absolute";
  //dialog.style.top = "200px";
  //dialog.style.color = "#000000";
  let body = dialog.querySelector(".bp3-dialog-body");

  console.log(resultJSX);
  // body.innerHTML = result;
  let cancelButton = dialog.querySelector(".bp3-button-text");
  cancelButton.innerText = "Close";
  let submitButton = dialog.querySelector(".bp3-button.bp3-intent-primary");
  submitButton.innerText = "Copy to clipboard";
  // let footer = dialog.querySelector(".bp3-dialog-footer");
  // footer.style.display = "none";
}

function getTotalTimeHTMLTable() {
  console.log("DailyLog:");
  console.log(mainDailyLog[0]);

  return (
    <table
      style={{
        border: "1px solid black",
        borderCollapse: "collapse",
        margin: "20px",
      }}
    >
      <thead>
        <tr style={{ backgroundColor: "#ddd" }}>
          <th style={{ border: "1px solid black", padding: "10px" }}>Year</th>
          <th style={{ border: "1px solid black", padding: "10px" }}>Month</th>
          {mainDailyLog[0].totals[0].totals.map((task) => (
            <th
              key={task[0]}
              style={{ border: "1px solid black", padding: "10px" }}
            >
              {task[0]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {mainDailyLog.map((yearObj, i) => {
          let rows = [];
          yearObj.totals.forEach((monthObj, index) => {
            let cells = [
              <td
                key={`year-${yearObj.year}`}
                rowSpan={monthObj.totals.length}
                style={{ border: "1px solid black", padding: "10px" }}
              >
                {index === 0 ? yearObj.year : ""}
              </td>,
              <td
                key={`month-${monthObj.month}`}
                style={{ border: "1px solid black", padding: "10px" }}
              >
                {monthObj.month}
              </td>,
            ];
            mainDailyLog[0].totals[0].totals.forEach((task) => {
              let taskObj = monthObj.totals.find((t) => t[0] === task[0]);
              cells.push(
                <td
                  key={`cell-${task[0]}`}
                  style={{ border: "1px solid black", padding: "10px" }}
                >
                  {taskObj ? taskObj[1] : 0}
                </td>
              );
            });
            rows.push(
              <tr
                key={`${yearObj.year}-${monthObj.month}`}
                style={{ backgroundColor: index % 2 === 0 ? "#fff" : "#eee" }}
              >
                {cells}
              </tr>
            );
          });
          return rows;
        })}
      </tbody>
    </table>
  );
}

//versio qui marche:
{
  /* <table className="maTable">
      <thead>
        <tr>
          <th>Year</th>
          <th>Month</th>
          {mainDailyLog[0].totals[0].totals.map((task) => (
            <th key={task[0]}>{task[0]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {mainDailyLog.map((yearObj) => {
          let rows = [];
          yearObj.totals.forEach((monthObj, index) => {
            let cells = [
              <td key={`year-${yearObj.year}`} rowSpan={monthObj.totals.length}>
                {yearObj.year}
              </td>,
              <td key={`month-${monthObj.rank}`}>{monthObj.rank}</td>,
            ];
            mainDailyLog[0].totals[0].totals.forEach((task) => {
              let taskObj = monthObj.totals.find((t) => t[0] === task[0]);
              cells.push(
                <td key={`cell-${task[0]}`}>{taskObj ? taskObj[1] : 0}</td>
              );
            });
            rows.push(
              <tr key={`${yearObj.year}-${monthObj.rank}`}>{cells}</tr>
            );
          });
          return rows;
        })}
      </tbody>
    </table> */
}

{
  /* <div>
      <table>
        <thead>
          <tr>
            <th>Année</th>
            <th>Mois</th>
            <th>Tâche</th>
            <th>Temps passé</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(mainDailyLog).map((year) =>
            mainDailyLog[year].totals.map((month, index) => (
              <React.Fragment key={`${year}-${index}`}>
                <tr className={index % 2 === 0 ? "even" : "odd"}>
                  <td rowSpan={month.totals.length}>
                    {mainDailyLog[year].year}
                  </td>
                  <td>{month.month}</td>
                  <td>{month.totals[0][0]}</td>
                  <td>{month.totals[0][1]}</td>
                </tr>
                {month.totals.slice(1).map((task, taskIndex) => (
                  <tr
                    className={index % 2 === 0 ? "even" : "odd"}
                    key={`${year}-${index}-${taskIndex}`}
                  >
                    <td>{task[0]}</td>
                    <td>{task[1]}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))
          )}{" "}
        </tbody>
      </table>
    </div> */
}

//   return (
//     <div>
//       <ul>
//         {
//           JSON.stringify(mainDailyLog)

//           /* {treeArray.map((node) => {
//             let pageMention = "[[" + getPageNameByPageUid(node.page) + "]]"; // getPageTitleByPage
//             textToCopy += pageMention + "\n";
//             return (
//               <li
//                 style={{
//                   listStyle: "none",
//                 }}
//               >
//                 {pageMention}
//                 {node.blocks.map((block) => {
//                   let blockRef = "((" + block.uid + "))";
//                   //let blockUrl = url + block.uid;
//                   let display = block.content + "\n";
//                   if (display.includes("```"))
//                     display = display.substring(0, codeBlockLimit) + " (...)";
//                   else {
//                     display = resolveReferences(display, [block.uid]);
//                     textToCopy += "  - " + display + "\n";
//                   }
//                   return (
//                     <ul
//                       style={{
//                         marginTop: "3px",
//                       }}
//                     >
//                       <li
//                         title={blockRef}
//                         style={{
//                           listStyleType: "disc",
//                         }}
//                       >
//                         {display}
//                         <button
//                           class="add-to-sidebar"
//                           title="Open this block in the right sidebar"
//                           onClick={() =>
//                             window.roamAlphaAPI.ui.rightSidebar.addWindow({
//                               window: { type: "block", "block-uid": block.uid },
//                             })
//                           }
//                         >
//                           ➕
//                         </button>
//                       </li>
//                     </ul>
//                   );
//                 })}
//                 <br />
//               </li>
//             );
//           })} */
//         }
//       </ul>
//     </div>
//   );
// }
