const vscode = require("vscode")

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.oneLineComments.toggleLineComment",
      () => {
        new OneLineComments().toggleLineComent()
      }
    )
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.oneLineComments.addLineComment",
      () => {
        new OneLineComments().addLineComment()
      }
    )
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.oneLineComments.remLineComment",
      () => {
        new OneLineComments().remLineComment()
      }
    )
  )
}

class OneLineComments {
  base(defaultCommand, func) {
    let editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }

    const doc = editor.document
    const supported = [
      "css",
      "html"
    ]

    if (supported.indexOf(doc.languageId) === -1) {
      // サポートしていなければ既存処理
      vscode.commands.executeCommand(defaultCommand)
      return
    }

    const selection = editor.selection
    const comment_start_pos = new vscode.Position(
      selection.start.line,
      0
    )
    const comment_end_pos = new vscode.Position(
      selection.end.line,
      doc.lineAt(selection.end.line).text.length
    )

    const comment_selection = new vscode.Selection(comment_start_pos, comment_end_pos)
    let text = doc.getText(comment_selection)

    text = func(text, doc.languageId)

    let edit = new vscode.WorkspaceEdit()

    const range = new vscode.Range(comment_start_pos, comment_end_pos)

    edit.replace(doc.uri, range, text)
    return vscode.workspace.applyEdit(edit)
  }

  toggleLineComent() {
    this.base(
      "editor.action.commentLine",
      (text, lang) => {
        switch (lang) {
          case "css":
            const css = new CSS(text)
            return css.toggleLineComent()

          case "html":
            const html = new HTML(text)
            return html.toggleLineComent()
        }
      }
    )
  }

  addLineComment() {
    this.base(
      "editor.action.addCommentLine",
      (text, lang) => {
        switch (lang) {
          case "css":
            const css = new CSS(text)
            return css.addLineComment()

          case "html":
            const html = new HTML(text)
            return html.addLineComment()
        }
      }
    )
  }

  remLineComment() {
    this.base(
      "editor.action.removeCommentLine",
      (text, lang) => {
        switch (lang) {
          case "css":
            const css = new CSS(text)
            return css.remLineComment()

          case "html":
            const html = new HTML(text)
            return html.remLineComment()
        }
      }
    )
  }
}

class CSS {
  constructor(text) {
    this.text = text
  }

  toggleLineComent() {
    let lines = this.text.split(/\r\n|\r|\n/)
    let isAddComment = false
    for (let i = 0; i < lines.length; i++) {
      // すべての行がコメント状態で無ければコメントにする
      if (lines[i].match(/^[\s\t]*\/\*.*\*\/.*?$/g) === null) {
        isAddComment = true
        break
      }
    }

    if (isAddComment) {
      return this.addLineComment()
    } else {
      return this.remLineComment()
    }
  }

  addLineComment() {
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === "") {
        continue
      }
      // "/* string */" to "/~ string ~/"
      lines[i] = lines[i].replace(
        /^(.*?)\/\*(.*)\*\/(.*?)$/g,
        "$1/~$2~/$3"
      )

      // "  string" to "  /* string */"
      // "  /~ string ~/" to "  /* /~ string ~/ */"
      lines[i] = lines[i].replace(
        /^([\s\t]*)(.*?)$/g,
        "$1/* $2 */"
      )
    }
    return lines.join("\n")
  }

  remLineComment() {
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      // "/* string */" to "string"
      // "/* /~ string ~/ */" to "/~ string ~/"
      lines[i] = lines[i].replace(
        /^(.*?)\/\*\s?(.*[^\s])\s?\*\/(.*?)$/g,
        "$1$2$3"
      )

      // "/~ string ~/" to "/* string */"
      // "/~ /~ string ~/ ~/" to "/* /~ string ~/ */"
      lines[i] = lines[i].replace(
        /^(.*?)\/\~(.*)\~\/(.*?)$/g,
        "$1/*$2*/$3"
      )
    }
    return lines.join("\n")
  }
}

class HTML {
  constructor(text) {
    this.text = text
  }

  toggleLineComent() {
    let lines = this.text.split(/\r\n|\r|\n/)
    let isAddComment = false
    for (let i = 0; i < lines.length; i++) {
      // すべての行がコメント状態の場合コメント解除
      if (lines[i].match(/^[\s\t]*<!--.*-->.*?$/g) === null) {
        isAddComment = true
        break
      }
    }

    if (isAddComment) {
      return this.addLineComment()
    } else {
      return this.remLineComment()
    }
  }

  addLineComment() {
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      // "<!-- string -->" to "<!~~ string ~~>"
      lines[i] = lines[i].replace(
        /^(.*?)<!--(.*)-->(.*?)$/g,
        "$1<!~~$2~~>$3"
      )

      // "  string" to "  <!-- string -->"
      // "  <!~~ string ~~>" to "  <!-- <!~~ string ~~> -->"
      lines[i] = lines[i].replace(
        /^([\s\t]*)(.*?)$/g,
        "$1<!-- $2 -->"
      )
    }
    return lines.join("\n")
  }

  remLineComment() {
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      // "<!-- string -->" to "string"
      // "<!-- <!~~ string ~~> -->" to "<!~~ string ~~>"
      lines[i] = lines[i].replace(
        /^(.*?)<!--\s?(.*[^\s])\s?-->(.*?)$/g,
        "$1$2$3"
      )

      // "<!~~ string ~~>" to "<!-- string -->"
      // "<!~~ <!~~ string ~~> ~~>" to "<!-- <!~~ string ~~> -->"
      lines[i] = lines[i].replace(
        /^(.*?)<!~~(.*)~~>(.*?)$/g,
        "$1<!--$2-->$3"
      )
    }
    return lines.join("\n")
  }
}

function deactivate() { }

module.exports = {
  activate,
  deactivate
}