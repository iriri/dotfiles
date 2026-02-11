filet indent on
filet plugin off
set bs=2
set nu
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
hi Visual ctermbg=4
hi CursorLine cterm=NONE ctermfg=NONE ctermbg=0
set cc=80
hi ColorColumn cterm=NONE ctermfg=NONE ctermbg=0
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
