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

    if (new CommentTags(doc.languageId).getTags() === null) {
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

class CommentTags {
  constructor(lang) {
    this.lang = lang
  }

  // 優先順位は、ユーザ設定 > デフォルトタグ > null
  getTags() {
    let resultTags
    let defaultTags = {
      "css": {
        "outer_start": "/*",
        "outer_end": "*/",
        "inner_start": "/~",
        "inner_end": "~/"
      },
      "html": {
        "outer_start": "<!--",
        "outer_end": "-->",
        "inner_start": "<!~~",
        "inner_end": "~~>"
      }
    }[this.lang]

    if (this.checkCommentTags(defaultTags)) {
      resultTags = defaultTags
    }

    let customCommentTags = vscode.workspace.getConfiguration(
      "oneLineComments.customCommentTags"
    )[this.lang]

    if (this.checkCommentTags(customCommentTags)) {
      // customCommentTagsは読み取り専用なので新たに生成する必要があった
      resultTags = {
        "outer_start": customCommentTags.outer_start,
        "outer_end": customCommentTags.outer_end,
        "inner_start": customCommentTags.inner_start,
        "inner_end": customCommentTags.inner_end
      }
    }

    if (!this.checkCommentTags(resultTags)) {
      return null
    }

    // エスケープ済みタグを追加
    resultTags.escaped = {}
    for (const key in resultTags) {
      if (key === "escaped") {
        continue
      }
      resultTags.escaped[key] = "\\" + resultTags[key].split("").join("\\")
    }
    return resultTags
  }

  checkCommentTags(tags) {
    if (typeof tags !== "object") {
      return false
    }

    const requiredItems = [
      "outer_start",
      "outer_end",
      "inner_start",
      "inner_end"
    ]

    for (const item of requiredItems) {
      if (!tags.hasOwnProperty(item)) {
        return false
      }

      const value = tags[item]
      if (typeof value !== "string") {
        return false
      }

      {
        const minLength = 1
        const maxLength = 5
        if (value.length < minLength) {
          return false
        }
        if (value.length > maxLength) {
          return false
        }
      }

      if (!(/^[!"#$%&'()\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~]+$/g).test(value)) {
        return false
      }
    }
    return true
  }
}

class CommentReplace {
  constructor(text, lang) {
    this.text = text
    this.lang = lang
  }

  toggleLineComent() {
    const tags = new CommentTags(this.lang).getTags()
    let lines = this.text.split(/\r\n|\r|\n/)
    let isAddComment = false
    for (let i = 0; i < lines.length; i++) {
      // 空文字、スペース、タブのみの行は無視
      if (lines[i].match(/^[\s\t]*$/g) !== null) {
        continue
      }
      // すべての行がコメント状態で無ければコメントにする
      if (lines[i].match(
        new RegExp(`^[\\s\\t]*${tags.escaped.outer_start}.*${tags.escaped.outer_end}.*?$`, "g")
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
    const tags = new CommentTags(this.lang).getTags()
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      // 空文字、スペース、タブのみの行は無視
      if (lines[i].match(/^[\s\t]*$/g) !== null) {
        continue
      }
      // startOuterTag string endOuterTag -> startInnerTag string endInnerTag
      lines[i] = lines[i].replace(
        new RegExp(`^(.*?)${tags.escaped.outer_start}(.*?)${tags.escaped.outer_end}(.*?)$`, "g"),
        `$1${tags.inner_start}$2${tags.inner_end}$3`
      )
      // indent string -> indent startOuterTag string endOuterTag
      lines[i] = lines[i].replace(
        /^([\s\t]*)(.*?)$/g,
        `$1${tags.outer_start} $2 ${tags.outer_end}`
      )
    }
    return lines.join("\n")
  }

  remLineComment() {
    const tags = new CommentTags(this.lang).getTags()
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      // startOuterTag string endOuterTag -> string
      lines[i] = lines[i].replace(
        new RegExp(`^(.*?)${tags.escaped.outer_start}\\s?(.*?)\\s?${tags.escaped.outer_end}(.*?)$`, "g"),
        "$1$2$3"
      )
      // startInnerTag string endInnerTag -> startOuterTag string endOuterTag
      lines[i] = lines[i].replace(
        new RegExp(`^(.*?)${tags.escaped.inner_start}(.*)${tags.escaped.inner_end}(.*?)$`, "g"),
        `$1${tags.outer_start}$2${tags.outer_end}$3`
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