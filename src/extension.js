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
        return new CommentReplace(text, lang).toggleLineComent()
      }
    )
  }

  addLineComment() {
    this.base(
      "editor.action.addCommentLine",
      (text, lang) => {
        return new CommentReplace(text, lang).addLineComment()
      }
    )
  }

  remLineComment() {
    this.base(
      "editor.action.removeCommentLine",
      (text, lang) => {
        return new CommentReplace(text, lang).remLineComment()
      }
    )
  }
}

class CommentReplace {
  constructor(text, lang) {
    this.text = text
    this.lang = lang
  }

  comment_tags() {
    // 参照時にエスケープされるため二重エスケープにしている
    return {
      "css": {
        "outer_start": "/*",
        "outer_end": "*/",
        "inner_start": "/~",
        "inner_end": "~/",
        "escaped": {
          "outer_start": "\\/\\*",
          "outer_end": "\\*\\/",
          "inner_start": "\\/\\~",
          "inner_end": "\\~\\/"
        }
      },
      "html": {
        "outer_start": "<!--",
        "outer_end": "-->",
        "inner_start": "<!~~",
        "inner_end": "~~!>",
        "escaped": {
          "outer_start": "\\<\\!\\-\\-",
          "outer_end": "\\-\\-\\>",
          "inner_start": "\\<\\!\\~\\~",
          "inner_end": "\\~\\~\\!\\>"
        }
      }
    }[this.lang]
  }

  toggleLineComent() {
    const cmt = this.comment_tags()
    let lines = this.text.split(/\r\n|\r|\n/)
    let isAddComment = false
    for (let i = 0; i < lines.length; i++) {
      // 空文字、スペース、タブのみの行は無視
      if (lines[i].match(/^[\s\t]*$/g) !== null) {
        continue
      }
      // すべての行がコメント状態で無ければコメントにする
      if (lines[i].match(
        new RegExp(`^[\\s\\t]*${cmt.escaped.outer_start}.*${cmt.escaped.outer_end}.*?$`, "g")
      ) === null) {
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
    const cmt = this.comment_tags()
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      // 空文字、スペース、タブのみの行は無視
      if (lines[i].match(/^[\s\t]*$/g) !== null) {
        continue
      }
      // startOuterTag string endOuterTag -> startInnerTag string endInnerTag
      lines[i] = lines[i].replace(
        new RegExp(`^(.*?)${cmt.escaped.outer_start}(.*?)${cmt.escaped.outer_end}(.*?)$`, "g"),
        `$1${cmt.inner_start}$2${cmt.inner_end}$3`
      )
      // indent string -> indent startOuterTag string endOuterTag
      lines[i] = lines[i].replace(
        /^([\s\t]*)(.*?)$/g,
        `$1${cmt.outer_start} $2 ${cmt.outer_end}`
      )
    }
    return lines.join("\n")
  }

  remLineComment() {
    const cmt = this.comment_tags()
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      // startOuterTag string endOuterTag -> string
      lines[i] = lines[i].replace(
        new RegExp(`^(.*?)${cmt.escaped.outer_start}\\s?(.*?)\\s?${cmt.escaped.outer_end}(.*?)$`, "g"),
        "$1$2$3"
      )
      // startInnerTag string endInnerTag -> startOuterTag string endOuterTag
      lines[i] = lines[i].replace(
        new RegExp(`^(.*?)${cmt.escaped.inner_start}(.*)${cmt.escaped.inner_end}(.*?)$`, "g"),
        `$1${cmt.outer_start}$2${cmt.outer_end}$3`
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