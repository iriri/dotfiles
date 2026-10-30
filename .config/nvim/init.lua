vim.g.editorconfig = false
vim.cmd([[
colo nord
filet indent on
filet plugin off
set noar
set bs=2
set mouse=
set nu
set scl=no
set nois
set hls
set et
set sts=3
set ai
set sw=3
set vb
set t_vb=
set sb
set spr
set hid
set nowrap
set bri
set list
set lcs=tab:>-,trail:~,precedes:<,extends:>
set ls=2
set stl=[%n:\%f]%m%r%w%y[%{&ff}][%{&enc}]%=[%l,%v][%P]
set cul
set cc=80
set winborder=single
set wim=longest,list,full

au BufReadPost *
 \ if line("'\"") >= 1 && line("'\"") <= line("$") && &ft !~# "commit" |
 \    exe "normal! g`\"" |
 \ endif

au FileType go,mbld,myr
 \ set noet |
 \ set sts=8 |
 \ set sw=8

au FileType cpp,fsharp,go,mbld,myr set cc=100
au FileType rust,typescript set cc=101
au FileType c,cpp,fsharp,rust set comments^=:///
au FileType c,cpp,rust set comments^=://!
au FileType cpp,fsharp,rust,typescript set mps+=<:>
]])

require("mini.align").setup()

vim.keymap.set("i", "<C-space>", "<C-x><C-o>")
vim.keymap.set("n", "<C-p>", function()
   vim.call("fzf#run", {
      source = "git ls-files",
      sink = "e",
      up = "49%",
   })
end)

vim.diagnostic.config({
   virtual_text = true,
   jump = {
      on_jump = function()
         vim.diagnostic.open_float({focus = false})
      end,
   },
})
vim.keymap.set("n", "gre", vim.diagnostic.open_float)
vim.keymap.set("n", "<esc>", function()
   for _, win in ipairs(vim.api.nvim_list_wins()) do
      if vim.api.nvim_win_get_config(win).relative == "win" then
         vim.api.nvim_win_close(win, false)
      end
   end
end)

vim.keymap.set("n", "]e", function()
   vim.diagnostic.jump({
      count = 1,
      severity = vim.diagnostic.severity.ERROR,
   })
end)
vim.keymap.set("n", "[e", function()
   vim.diagnostic.jump({
      count = -1,
      severity = vim.diagnostic.severity.ERROR,
   })
end)

vim.keymap.set("n", "grl", function()
   vim.diagnostic.setloclist()
end)
vim.keymap.set("n", "grq", function()
   vim.diagnostic.setqflist()
end)

vim.api.nvim_create_autocmd("FileType", {
   pattern = "qf",
   callback = function()
      vim.keymap.set("n", "<CR>", "<CR>:cclose<CR>", {
         buffer = true,
         silent = true,
      })
   end,
})

vim.api.nvim_create_autocmd("LspAttach", {
   callback = function(evt)
      vim.bo[evt.buf].formatexpr = nil
      vim.bo[evt.buf].formatprg = nil
   end,
})

if vim.env.TERM_PROGRAM == "tmux" then
   vim.api.nvim_create_autocmd("VimResume", {
      callback = function()
         vim.cmd("checkt")
      end,
   })
end

vim.lsp.config["fsautocomplete"] = {
   cmd = vim.lsp.rpc.connect("/run/user/1000/lspmux.sock"),
   filetypes = {"fsharp"},
   root_dir = function(bufnum, f)
      f(vim.fs.root(bufnum, {
         function(name, _)
            return name:match("%.slnx?$") ~= nil
         end,
         function(name, _)
            return name:match("%.fsproj$") ~= nil
         end,
      }))
   end,
   init_options = {
      AutomaticWorkspaceInit = true,
      lspMux = {
         version = "1",
         method = "connect",
         server = vim.fn.expand("~/.dotnet/tools/fsautocomplete"),
         args = {"--adaptive-lsp-server-enabled"},
      },
   },
   settings = {
      FSharp = {
         GenerateBinlog = false,
         Linter = true,
         UnionCaseStubGeneration = true,
         UnionCaseStubGenerationBody = 'failwith "Not Implemented"',
         RecordStubGeneration = true,
         RecordStubGenerationBody = 'failwith "Not Implemented"',
         InterfaceStubGeneration = true,
         InterfaceStubGenerationObjectIdentifier = 'this',
         InterfaceStubGenerationMethodBody = 'failwith "Not Implemented"',
         SimplifyNameAnalyzer = true,
         UnnecessaryParenthesesAnalyzer = false,
         UnusedOpensAnalyzer = true,
         UnusedDeclarationsAnalyzer = true,
         UseSdkScripts = true,
         ResolveNamespaces = true,
      },
   },
}
vim.lsp.enable("fsautocomplete")

vim.lsp.config["rust-analyzer"] = {
   cmd = vim.lsp.rpc.connect("/run/user/1000/lspmux.sock"),
   filetypes = {"rust"},
   root_markers = {"Cargo.lock"},
   init_options = {
      lspMux = {
         version = "1",
         method = "connect",
         server = vim.fn.expand("~/.cargo/bin/rust-analyzer"),
      },
   },
   settings = {
      ["rust-analyzer"] = {
         check = {command = "clippy"},
         completion = {callable = {snippets = "none"}},
         diagnostics = {disabled = {"inactive_code"}},
         imports = {
            granularity = {group = "module"},
            merge = {glob = false},
         },
      },
   },
}
vim.lsp.enable("rust-analyzer")

vim.lsp.config["deno lsp"] = {
   cmd = vim.lsp.rpc.connect("/run/user/1000/lspmux.sock"),
   filetypes = {"typescript"},
   root_markers = {"deno.lock"},
   init_options = {
      lspMux = {
         version = "1",
         method = "connect",
         server = vim.fn.expand("~/.deno/bin/deno"),
         args = {"lsp"},
         env = {NO_COLOR = "1"},
      },
   },
   settings = {
      deno = {
         enable = true,
         unstable = true,
         suggest = {
            completeFunctionCalls = false,
            imports = {autoDiscover = false},
         },
      },
   },
}
vim.lsp.enable("deno lsp")

vim.lsp.config["gopls"] = {
   cmd = vim.lsp.rpc.connect("/run/user/1000/lspmux.sock"),
   filetypes = {"go"},
   root_markers = {"go.mod", "go.work"},
   init_options = {
      lspMux = {
         version = "1",
         method = "connect",
         server = vim.fn.expand("~/devel/go/bin/gopls"),
      },
   },
   settings = {
      gopls = {
         gofumpt = true,
         staticcheck = true,
      },
   },
}
vim.lsp.enable("gopls")

vim.lsp.config["ty"] = {
   cmd = vim.lsp.rpc.connect("/run/user/1000/lspmux.sock"),
   filetypes = {"python"},
   root_markers = {"uv.lock"},
   init_options = {
      lspMux = {
         version = "1",
         method = "connect",
         server = vim.fn.expand("~/.local/bin/ty"),
         args = {"server"},
      },
   },
}
vim.lsp.enable("ty")

vim.lsp.config["endo"] = {
   cmd = vim.lsp.rpc.connect("/run/user/1000/lspmux.sock"),
   filetypes = {"endo"},
   root_markers = {".git"},
   init_options = {
      lspMux = {
         version = "1",
         method = "connect",
         server = vim.fn.expand("~/.local/bin/endo"),
         args = {"--lsp"},
      },
   },
}
vim.lsp.enable("endo")

vim.lsp.config["quint-language-server"] = {
   cmd = vim.lsp.rpc.connect("/run/user/1000/lspmux.sock"),
   filetypes = {"quint"},
   root_markers = {".git"},
   init_options = {
      lspMux = {
         version = "1",
         method = "connect",
         server = vim.fn.expand("~/.deno/bin/quint-language-server"),
         args = {"--stdio"},
      },
   },
}
vim.lsp.enable("quint-language-server")

vim.api.nvim_set_hl(0, "DiffVisual", {fg = "#d8dee9", bg = "#4c566a"})
vim.api.nvim_create_autocmd({"WinEnter", "OptionSet"}, {
   callback = function()
      vim.wo.winhighlight = vim.wo.diff and "Visual:DiffVisual" or ""
   end,
})
