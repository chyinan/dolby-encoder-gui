#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <errno.h>
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <direct.h>
#endif

static const char *DEFAULT_DEE_ROOT = "D:\\Dolby_Encoding_Engine";

static void copy_string(char *dest, size_t dest_size, const char *src);
static void normalize_slashes(char *path);
static void ensure_directory_exists(const char *path);
static void ensure_parent_directory(const char *file_path);
#ifdef _WIN32
static void quote_argument(char *dest, size_t dest_size, const char *src);
static void format_win32_error(DWORD error_code, char *buffer, size_t buffer_size);
#endif

static int case_equal(const char *a, const char *b) {
    if (!a || !b) return 0;
    while (*a && *b) {
        if (tolower((unsigned char)*a) != tolower((unsigned char)*b)) {
            return 0;
        }
        ++a;
        ++b;
    }
    return *a == '\0' && *b == '\0';
}

static int ends_with_extension(const char *path, const char *ext) {
    if (!path || !ext) return 0;
    size_t path_len = strlen(path);
    size_t ext_len = strlen(ext);
    if (path_len < ext_len) return 0;
    const char *path_ext = path + path_len - ext_len;
    return case_equal(path_ext, ext);
}

static void ensure_extension(char *path, size_t size, const char *ext) {
    if (!path || !ext || !*ext) return;
    normalize_slashes(path);
    if (ends_with_extension(path, ext)) {
        return;
    }
    char *last_slash = strrchr(path, '\\');
    char *last_slash_alt = strrchr(path, '/');
    if (last_slash_alt && (!last_slash || last_slash_alt > last_slash)) last_slash = last_slash_alt;
    char *dot = strrchr(path, '.');
    if (!dot || (last_slash && dot < last_slash)) {
        size_t cur_len = strlen(path);
        size_t ext_len = strlen(ext);
        if (cur_len + ext_len < size) {
            strcat(path, ext);
        }
        return;
    }
    *dot = '\0';
    size_t cur_len = strlen(path);
    size_t ext_len = strlen(ext);
    if (cur_len + ext_len < size) {
        strcat(path, ext);
    }
}

static void normalize_slashes(char *path) {
    if (!path) return;
    for (char *p = path; *p; ++p) {
        if (*p == '/') *p = '\\';
    }
}

static void build_path(char *dest, size_t dest_size, const char *base, const char *relative) {
    if (!dest || dest_size == 0) return;
    dest[0] = '\0';

    if (base && base[0]) {
        copy_string(dest, dest_size, base);
        normalize_slashes(dest);
        size_t len = strlen(dest);
        if (len > 0 && dest[len - 1] != '\\') {
            if (len + 1 < dest_size) {
                dest[len++] = '\\';
                dest[len] = '\0';
            }
        }
    }

    if (relative && relative[0]) {
        size_t cur_len = strlen(dest);
        strncat(dest, relative, dest_size - cur_len - 1);
    }

    normalize_slashes(dest);
}

static void ensure_directory_exists(const char *path) {
#ifdef _WIN32
    if (!path || !*path) return;
    char buffer[1024];
    copy_string(buffer, sizeof(buffer), path);
    normalize_slashes(buffer);
    size_t len = strlen(buffer);
    if (len == 0) return;
    if (buffer[len - 1] == '\\' && len > 1) {
        buffer[len - 1] = '\0';
        len--;
    }

    for (size_t i = 0; i <= len; ++i) {
        if (buffer[i] == '\\' || buffer[i] == '\0') {
            char saved = buffer[i];
            buffer[i] = '\0';
            if (buffer[0] != '\0') {
                if (!(buffer[1] == ':' && buffer[2] == '\0')) {
                    if (_mkdir(buffer) != 0 && errno != EEXIST) {
                        // ignore errors other than path already exists
                    }
                }
            }
            buffer[i] = saved;
        }
    }
#else
    (void)path;
#endif
}

static void ensure_parent_directory(const char *file_path) {
#ifdef _WIN32
    if (!file_path || !*file_path) return;
    char buffer[1024];
    copy_string(buffer, sizeof(buffer), file_path);
    normalize_slashes(buffer);
    char *last_sep = strrchr(buffer, '\\');
    if (!last_sep) last_sep = strrchr(buffer, '/');
    if (last_sep) {
        *last_sep = '\0';
        ensure_directory_exists(buffer);
    }
#else
    (void)file_path;
#endif
}


static void copy_string(char *dest, size_t dest_size, const char *src) {
    if (!dest || dest_size == 0) {
        return;
    }
    if (!src) {
        dest[0] = '\0';
        return;
    }
    int written = snprintf(dest, dest_size, "%s", src);
    if (written < 0) {
        dest[0] = '\0';
    }
}

#ifdef _WIN32
static void quote_argument(char *dest, size_t dest_size, const char *src) {
    if (!dest || dest_size == 0) return;
    dest[0] = '\0';
    if (!src) return;

    size_t pos = 0;
    if (pos < dest_size - 1) dest[pos++] = '"';

    size_t len = strlen(src);
    size_t i = 0;
    while (i < len && pos < dest_size - 1) {
        size_t backslash_count = 0;
        while (i < len && src[i] == '\\') {
            ++backslash_count;
            ++i;
        }

        if (i == len) {
            for (size_t k = 0; k < backslash_count * 2 && pos < dest_size - 1; ++k) {
                dest[pos++] = '\\';
            }
            break;
        }

        if (src[i] == '"') {
            for (size_t k = 0; k < backslash_count * 2 + 1 && pos < dest_size - 1; ++k) {
                dest[pos++] = '\\';
            }
            if (pos < dest_size - 1) dest[pos++] = '"';
            ++i;
            continue;
        }

        for (size_t k = 0; k < backslash_count && pos < dest_size - 1; ++k) {
            dest[pos++] = '\\';
        }
        if (pos < dest_size - 1) dest[pos++] = src[i++];
    }

    if (pos < dest_size - 1) dest[pos++] = '"';
    dest[pos] = '\0';
}

static void format_win32_error(DWORD error_code, char *buffer, size_t buffer_size) {
    if (!buffer || buffer_size == 0) return;
    DWORD length = FormatMessageA(
        FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
        NULL,
        error_code,
        MAKELANGID(LANG_NEUTRAL, SUBLANG_DEFAULT),
        buffer,
        (DWORD)buffer_size,
        NULL);
    if (length == 0) {
        snprintf(buffer, buffer_size, "Unknown error (%lu)", (unsigned long)error_code);
        return;
    }
    while (length > 0 && (buffer[length - 1] == '\r' || buffer[length - 1] == '\n')) {
        buffer[--length] = '\0';
    }
}
#endif

// 去掉字符串里的换行符
void trim_newline(char *str) {
    size_t len = strlen(str);
    if (len > 0 && (str[len - 1] == '\n' || str[len - 1] == '\r')) {
        str[len - 1] = '\0';
    }
}

// --------- 持久化上次操作参数的结构与函数 ---------
typedef struct {
    int choice; /* 1: ec3, 2: m4a */
    char start[64];
    char end[64];
    char prepend_silence[64];
    char append_silence[64];
    char template_xml[512];
    char output_file[512];
    char input_file[512];
    int valid; /* 1 表示有效记录，0 表示无记录 */
} LastParams;

static void save_last_params(const char *path, const LastParams *p) {
    FILE *f = fopen(path, "w");
    if (!f) {
        fprintf(stderr, "无法打开状态文件进行写入: %s (errno=%d)\n", path, errno);
        return;
    }
    fprintf(f, "choice=%d\n", p->choice);
    fprintf(f, "start=%s\n", p->start);
    fprintf(f, "end=%s\n", p->end);
    fprintf(f, "prepend_silence=%s\n", p->prepend_silence);
    fprintf(f, "append_silence=%s\n", p->append_silence);
    fprintf(f, "template_xml=%s\n", p->template_xml);
    fprintf(f, "output_file=%s\n", p->output_file);
    fprintf(f, "input_file=%s\n", p->input_file);
    fprintf(f, "valid=1\n");
    fclose(f);
    printf("DEBUG: Saving params: choice=%d, start='%s', end='%s', prepend='%s', append='%s', template='%s', output='%s', input='%s', valid=%d\n",
           p->choice, p->start, p->end, p->prepend_silence, p->append_silence, p->template_xml, p->output_file, p->input_file, p->valid);
    printf("已保存上一次操作参数到: %s\n", path);
}

static void load_last_params(const char *path, LastParams *out) {
    FILE *f = fopen(path, "r");
    char buf[1024];
    if (!f) {
        out->valid = 0;
        return;
    }
    /* 先设置默认空串 */
    out->choice = 0;
    out->start[0] = out->end[0] = out->prepend_silence[0] = out->append_silence[0] = '\0';
    out->template_xml[0] = out->output_file[0] = out->input_file[0] = '\0';
    out->valid = 0;

    while (fgets(buf, sizeof(buf), f)) {
        trim_newline(buf);
        char *eq = strchr(buf, '=');
        if (!eq) continue;
        *eq = '\0';
        char *key = buf;
        char *value = eq + 1;
        if (strcmp(key, "choice") == 0) out->choice = atoi(value);
        else if (strcmp(key, "start") == 0) copy_string(out->start, sizeof(out->start), value);
        else if (strcmp(key, "end") == 0) copy_string(out->end, sizeof(out->end), value);
        else if (strcmp(key, "prepend_silence") == 0) copy_string(out->prepend_silence, sizeof(out->prepend_silence), value);
        else if (strcmp(key, "append_silence") == 0) copy_string(out->append_silence, sizeof(out->append_silence), value);
        else if (strcmp(key, "template_xml") == 0) copy_string(out->template_xml, sizeof(out->template_xml), value);
        else if (strcmp(key, "output_file") == 0) copy_string(out->output_file, sizeof(out->output_file), value);
        else if (strcmp(key, "input_file") == 0) copy_string(out->input_file, sizeof(out->input_file), value);
        else if (strcmp(key, "valid") == 0 && atoi(value) == 1) out->valid = 1;
    }
    fclose(f);
    if (out->valid) {
        printf("已加载上一次操作参数（%s）。\n", path);
    } else {
        printf("状态文件存在但解析后无有效记录（%s）。\n", path);
    }
}
// --------- 持久化相关结束 ---------

// 生成临时 XML 文件
void generate_xml(const char *template_xml, const char *temp_xml,
                  const char *input_file, const char *output_file,
                  const char *start, const char *end, const char *prepend_silence, const char *append_silence)
{
    FILE *in = fopen(template_xml, "r");
    FILE *out = fopen(temp_xml, "w");
    if (!in || !out) {
        printf("无法打开模板或临时文件！\n");
        if (in) fclose(in);
        if (out) fclose(out);
        return;
    }

    char line[1024];
    int in_encode_section = 0;

    while (fgets(line, sizeof(line), in)) {
        // 进入/离开 <encode_to_atmos_ddp> 区块
        if (strstr(line, "<encode_to_atmos_ddp")) {
            in_encode_section = 1;
        } else if (strstr(line, "</encode_to_atmos_ddp>")) {
            in_encode_section = 0;
        }

        // 在 encode_to_atmos_ddp 区块内按需替换 <start> 与 <end>
        if (in_encode_section && strstr(line, "<start>")) {
                // 保留原缩进
                const char *p = line;
                while (*p == ' ' || *p == '\t') p++;
                int indent_len = (int)(p - line);
            if (start != NULL && strlen(start) > 0) {
                if (indent_len > 0) {
                    fprintf(out, "%.*s<start>%s</start>\n", indent_len, line, start);
                } else {
                    fprintf(out, "<start>%s</start>\n", start);
                }
            } else {
                // 如果 start 为空，生成空标签
                if (indent_len > 0) {
                    fprintf(out, "%.*s<start></start>\n", indent_len, line);
                } else {
                    fprintf(out, "<start></start>\n");
                }
                }
                continue;
        }

        if (in_encode_section && strstr(line, "<end>")) {
                // 保留原缩进
                const char *p = line;
                while (*p == ' ' || *p == '\t') p++;
                int indent_len = (int)(p - line);
            if (end != NULL && strlen(end) > 0) {
                if (indent_len > 0) {
                    fprintf(out, "%.*s<end>%s</end>\n", indent_len, line, end);
                } else {
                    fprintf(out, "<end>%s</end>\n", end);
                }
            } else {
                // 如果 end 为空，生成空标签
                if (indent_len > 0) {
                    fprintf(out, "%.*s<end></end>\n", indent_len, line);
                } else {
                    fprintf(out, "<end></end>\n");
                }
                }
                continue;
        }

        // 替换开头空白时长
        if (in_encode_section && strstr(line, "<prepend_silence_duration>")) {
            if (prepend_silence != NULL && strlen(prepend_silence) > 0) {
                // 保留原缩进
                const char *p = line;
                while (*p == ' ' || *p == '\t') p++;
                int indent_len = (int)(p - line);
                if (indent_len > 0) {
                    fprintf(out, "%.*s<prepend_silence_duration>%s</prepend_silence_duration>\n", indent_len, line, prepend_silence);
                } else {
                    fprintf(out, "<prepend_silence_duration>%s</prepend_silence_duration>\n", prepend_silence);
                }
                continue;
            }
        }

        // 替换结尾空白时长
        if (in_encode_section && strstr(line, "<append_silence_duration>")) {
            if (append_silence != NULL && strlen(append_silence) > 0) {
                const char *p = line;
                while (*p == ' ' || *p == '\t') p++;
                int indent_len = (int)(p - line);
                if (indent_len > 0) {
                    fprintf(out, "%.*s<append_silence_duration>%s</append_silence_duration>\n", indent_len, line, append_silence);
                } else {
                    fprintf(out, "<append_silence_duration>%s</append_silence_duration>\n", append_silence);
                }
                continue;
            }
        }

        // 替换输出文件路径和文件名
        if (strstr(line, "<path>PATH</path>")) {
            const char *p = line;
            while (*p == ' ' || *p == '\t') p++;
            int indent_len = (int)(p - line);
            // 提取目录路径（去掉文件名）
            char dir_path[1024];
            strcpy(dir_path, output_file);
            char *last_slash = strrchr(dir_path, '\\');
            if (last_slash) {
                *last_slash = '\0';
                // 如果路径变成空或只有盘符，添加反斜杠
                if (strlen(dir_path) <= 2) {
                    strcat(dir_path, "\\");
                }
            } else {
                strcpy(dir_path, "D:\\"); // 默认目录
            }
            if (indent_len > 0) {
                fprintf(out, "%.*s<path>%s</path>\n", indent_len, line, dir_path);
            } else {
                fprintf(out, "<path>%s</path>\n", dir_path);
            }
            continue;
        }

        if (strstr(line, "<file_name>FILE_NAME</file_name>")) {
            const char *p = line;
            while (*p == ' ' || *p == '\t') p++;
            int indent_len = (int)(p - line);
            // 提取文件名
            const char *filename = strrchr(output_file, '\\');
            filename = filename ? filename + 1 : output_file;
            if (indent_len > 0) {
                fprintf(out, "%.*s<file_name>%s</file_name>\n", indent_len, line, filename);
            } else {
                fprintf(out, "<file_name>%s</file_name>\n", filename);
            }
            continue;
        }

        // 其它原样写出
        fputs(line, out);
    }

    fclose(in);
    fclose(out);
}

int main(int argc, char *argv[])
{
    system("chcp 65001 > nul"); // 设置控制台UTF-8

    int choice;
    char start[64], end[64], prepend_silence[64], append_silence[64]; 
    char output_file_buf[512]; // 用于存储 output_file，因为其需要被修改
    char input_file_buf[512]; // 用于存储 input_file
    char cmd[4096]; 
    char base_path[512];
    char temp_xml_path[1024];
    char dee_exe_path[1024];
    char temp_dir_path[1024];
    char template_ec3_path[1024];
    char template_m4a_path[1024];
    const char *template_xml = NULL;
    const char *state_file = "last_params.txt";
    LastParams last_params;

    const char *env_base = getenv("DEE_ROOT");
    if (env_base && env_base[0]) {
        copy_string(base_path, sizeof(base_path), env_base);
    } else {
        copy_string(base_path, sizeof(base_path), DEFAULT_DEE_ROOT);
    }
    normalize_slashes(base_path);

    build_path(temp_xml_path, sizeof(temp_xml_path), base_path, "temp_job.xml");
    build_path(dee_exe_path, sizeof(dee_exe_path), base_path, "dee.exe");
    build_path(temp_dir_path, sizeof(temp_dir_path), base_path, "DolbyTemp");
    build_path(template_ec3_path, sizeof(template_ec3_path), base_path, "xml_templates\\encode_to_atmos_ddp\\atmos_mezz_encode_to_atmos_ddp_ec3.xml");
    build_path(template_m4a_path, sizeof(template_m4a_path), base_path, "xml_templates\\encode_to_atmos_ddp\\atmos_mezz_encode_to_atmos_ddp_mp4.xml");

    printf("使用 Dolby Encoding Engine 路径: %s\n", base_path);

    ensure_parent_directory(temp_xml_path);
    ensure_directory_exists(temp_dir_path);
    load_last_params(state_file, &last_params);

    // 初始化所有参数为空字符串，以便于后续逻辑判断
    start[0] = end[0] = prepend_silence[0] = append_silence[0] = output_file_buf[0] = input_file_buf[0] = '\0';
    choice = 0;

    if (argc > 1) {
        // 从命令行参数解析
        choice = atoi(argv[1]);
        if (argc > 2 && strlen(argv[2]) > 0) copy_string(start, sizeof(start), argv[2]);
        if (argc > 3 && strlen(argv[3]) > 0) copy_string(end, sizeof(end), argv[3]);
        if (argc > 4 && strlen(argv[4]) > 0) copy_string(prepend_silence, sizeof(prepend_silence), argv[4]);
        if (argc > 5 && strlen(argv[5]) > 0) copy_string(append_silence, sizeof(append_silence), argv[5]);
        if (argc > 6 && strlen(argv[6]) > 0) copy_string(output_file_buf, sizeof(output_file_buf), argv[6]);
        if (argc > 7 && strlen(argv[7]) > 0) copy_string(input_file_buf, sizeof(input_file_buf), argv[7]);

        // 检查 output_file_buf 和 input_file_buf 是否为空，如果为空则使用默认值
        if (output_file_buf[0] == '\0') {
             if (choice == 1) {
                 copy_string(output_file_buf, sizeof(output_file_buf), "D:\\atmos.ec3");
             } else if (choice == 2) {
                 copy_string(output_file_buf, sizeof(output_file_buf), "D:\\atmos.m4a");
             }
        }
        if (input_file_buf[0] == '\0') {
            copy_string(input_file_buf, sizeof(input_file_buf), "D:\\ADM.wav");
        }

        if (choice == 1) {
            ensure_extension(output_file_buf, sizeof(output_file_buf), ".ec3");
        } else if (choice == 2) {
            ensure_extension(output_file_buf, sizeof(output_file_buf), ".m4a");
        }

        printf("DEBUG: Parsed CLI args -> choice=%d, start='%s', end='%s', prepend='%s', append='%s', output='%s', input='%s'\n",
               choice, start, end, prepend_silence, append_silence, output_file_buf, input_file_buf);

        // 根据 choice 设置 template_xml
        if (choice == 1) {
            template_xml = template_ec3_path;
        } else if (choice == 2) {
            template_xml = template_m4a_path;
        } else {
            fprintf(stderr, "错误: 无效的编码选项（%d）。\n", choice);
            system("pause");
            return 1;
        }

        // 跳过交互式菜单，直接进入编码流程
        goto encode_process;

    } else {
        // 没有命令行参数，显示交互式菜单
    while (1)
    {
        printf("\n=============================\n");
        printf("  Dolby Encoding Engine 工具\n");
        printf("=============================\n");
        printf("1. ADM BWF 编码为 atmos.ec3\n");
        printf("2. ADM BWF 编码为 atmos.m4a\n");
        printf("3. 重复上一次操作\n");
        printf("0. 退出程序\n");
        printf("请输入选项: ");

        if (scanf("%d", &choice) != 1) {
            printf("输入无效，请输入数字！\n");
            while (getchar() != '\n'); 
            continue;
        }
        while (getchar() != '\n'); // 清空缓冲

        if (choice == 0) {
            printf("退出程序。\n");
            break;
        }

        /* 如果选择 3：直接使用上次保存的参数并跳过交互 */
        if (choice == 3) {
            if (!last_params.valid) {
                printf("没有可用的上一次操作记录，无法重复。\n");
                continue;
            }
            /* 从上次记录拷贝参数 */
            copy_string(start, sizeof(start), last_params.start);
            copy_string(end, sizeof(end), last_params.end);
            copy_string(prepend_silence, sizeof(prepend_silence), last_params.prepend_silence);
            copy_string(append_silence, sizeof(append_silence), last_params.append_silence);
            if (last_params.output_file[0]) {
                copy_string(output_file_buf, sizeof(output_file_buf), last_params.output_file);
            } else {
                copy_string(output_file_buf, sizeof(output_file_buf), "D:\\atmos.ec3");
            }
            if (last_params.input_file[0]) {
                copy_string(input_file_buf, sizeof(input_file_buf), last_params.input_file);
            } else {
                copy_string(input_file_buf, sizeof(input_file_buf), "D:\\ADM.wav");
            }
            /* 使用上次保存的类型（如果有）作为本次的具体格式 */
            choice = last_params.choice ? last_params.choice : 1;
            if (last_params.template_xml[0]) {
                template_xml = last_params.template_xml;
            } else if (choice == 1) {
                template_xml = template_ec3_path;
            } else if (choice == 2) {
                template_xml = template_m4a_path;
            }
            if (choice == 1) {
                ensure_extension(output_file_buf, sizeof(output_file_buf), ".ec3");
            } else if (choice == 2) {
                ensure_extension(output_file_buf, sizeof(output_file_buf), ".m4a");
            }
                printf("使用上一次参数：choice=%d, start='%s', end='%s', prepend='%s', append='%s', out='%s'\n", choice, start, end, prepend_silence, append_silence, output_file_buf);
        } else {
            /* 普通选项 1 或 2：交互式输入（回车表示空，保留模板默认） */
            printf("请输入起始时间 (HH:MM:SS:FF / HH:MM:SS.xx，直接回车默认): ");
            if (fgets(start, sizeof(start), stdin)) trim_newline(start);

            printf("请输入结束时间 (HH:MM:SS:FF / HH:MM:SS.xx，直接回车默认): ");
            if (fgets(end, sizeof(end), stdin)) trim_newline(end);

            printf("请输入开头空白时长 (秒，如10.0，直接回车默认0.0): ");
            if (fgets(prepend_silence, sizeof(prepend_silence), stdin)) trim_newline(prepend_silence);

            printf("请输入结尾空白时长 (秒，如5.0，直接回车默认0.0): ");
            if (fgets(append_silence, sizeof(append_silence), stdin)) trim_newline(append_silence);

                // 交互模式下设置 output_file_buf 和 input_file_buf 默认值
                if (choice == 1) {
                    copy_string(output_file_buf, sizeof(output_file_buf), "D:\\atmos.ec3");
                } else if (choice == 2) {
                    copy_string(output_file_buf, sizeof(output_file_buf), "D:\\atmos.m4a");
                }
                copy_string(input_file_buf, sizeof(input_file_buf), "D:\\ADM.wav");
        }

        if (choice == 1) {
            template_xml = template_ec3_path;
        } else if (choice == 2) {
            template_xml = template_m4a_path;
        } else {
            printf("无效选项，请重新输入。\n");
            continue;
        }

        if (choice == 1) {
            ensure_extension(output_file_buf, sizeof(output_file_buf), ".ec3");
        } else if (choice == 2) {
            ensure_extension(output_file_buf, sizeof(output_file_buf), ".m4a");
        }

            goto encode_process; // 完成交互后跳转到编码流程
        }
    }

encode_process:
    if (!template_xml || template_xml[0] == '\0') {
        fprintf(stderr, "错误: 未找到编码模板路径，请检查 DEE_ROOT 设置是否正确。\n");
        system("pause");
        return 1;
    }

    if (dee_exe_path[0] == '\0') {
        fprintf(stderr, "错误: 未设置 dee.exe 路径，请检查 DEE_ROOT 设置是否正确。\n");
        system("pause");
        return 1;
    }

        /* 生成临时 XML */
    generate_xml(template_xml, temp_xml_path, input_file_buf, output_file_buf, start, end, prepend_silence, append_silence);

        /* 执行 dee */
        int cmd_len = 0;
#ifdef _WIN32
        char quoted_dee_exe[1024];
        char quoted_temp_xml[2048];
        char quoted_input_file[2048];
        char quoted_output_file[2048];
        char quoted_temp_dir[2048];

        quote_argument(quoted_dee_exe, sizeof(quoted_dee_exe), dee_exe_path);
        quote_argument(quoted_temp_xml, sizeof(quoted_temp_xml), temp_xml_path);
        quote_argument(quoted_input_file, sizeof(quoted_input_file), input_file_buf);
        quote_argument(quoted_output_file, sizeof(quoted_output_file), output_file_buf);
        quote_argument(quoted_temp_dir, sizeof(quoted_temp_dir), temp_dir_path);

        cmd_len = snprintf(cmd, sizeof(cmd),
            "%s -x %s -a %s -o %s --temp %s",
            quoted_dee_exe, quoted_temp_xml, quoted_input_file, quoted_output_file, quoted_temp_dir);
#else
        cmd_len = snprintf(cmd, sizeof(cmd),
            "\"%s\" -x \"%s\" -a \"%s\" -o \"%s\" --temp \"%s\"",
            dee_exe_path, temp_xml_path, input_file_buf, output_file_buf, temp_dir_path);
#endif
        if (cmd_len < 0 || cmd_len >= (int)sizeof(cmd)) {
            fprintf(stderr, "错误: 构建命令行失败或过长，请检查路径设置。\n");
            system("pause");
            return 1;
        }

    // ========== DEBUG: 打印生成的 temp_job.xml 内容 ==========
    printf("\n========== START temp_job.xml CONTENT ===========\n");
    FILE *debug_f = fopen(temp_xml_path, "r");
    if (debug_f) {
        char debug_line[1024];
        while (fgets(debug_line, sizeof(debug_line), debug_f)) {
            printf("%s", debug_line);
        }
        fclose(debug_f);
    } else {
        printf("无法打开 temp_job.xml 进行调试读取！\n");
    }
    printf("========== END temp_job.xml CONTENT ===========\n\n");
    // ========================================================

        /* 先保存本次参数以便下次重复（放在执行前，避免执行过程中意外退出导致丢失） */
        LastParams cur = {0};
        cur.choice = choice;
        copy_string(cur.start, sizeof(cur.start), start);
        copy_string(cur.end, sizeof(cur.end), end);
        copy_string(cur.prepend_silence, sizeof(cur.prepend_silence), prepend_silence);
        copy_string(cur.append_silence, sizeof(cur.append_silence), append_silence);
        copy_string(cur.template_xml, sizeof(cur.template_xml), template_xml ? template_xml : "");
        copy_string(cur.output_file, sizeof(cur.output_file), output_file_buf);
        copy_string(cur.input_file, sizeof(cur.input_file), input_file_buf);
        cur.valid = 1;
        save_last_params(state_file, &cur);
        /* 更新内存中的 last_params */
        last_params = cur;

        printf("执行命令: %s\n", cmd);
        fflush(stdout);

    int exit_code = 0;
#ifdef _WIN32
    char command_line[4096];
    copy_string(command_line, sizeof(command_line), cmd);

    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    BOOL success = CreateProcessA(
        dee_exe_path,
        command_line,
        NULL,
        NULL,
        FALSE,
        0,
        NULL,
        NULL,
        &si,
        &pi);

    if (!success) {
        DWORD err = GetLastError();
        char err_msg[256];
        format_win32_error(err, err_msg, sizeof(err_msg));
        fprintf(stderr, "调用 dee.exe 失败 (error=%lu): %s\n", (unsigned long)err, err_msg);
        exit_code = (int)err;
    } else {
        WaitForSingleObject(pi.hProcess, INFINITE);
        DWORD proc_exit_code = 0;
        if (!GetExitCodeProcess(pi.hProcess, &proc_exit_code)) {
            DWORD err = GetLastError();
            char err_msg[256];
            format_win32_error(err, err_msg, sizeof(err_msg));
            fprintf(stderr, "获取 dee.exe 退出码失败 (error=%lu): %s\n", (unsigned long)err, err_msg);
            exit_code = (int)err;
        } else {
            exit_code = (int)proc_exit_code;
        }
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
    }
#else
    exit_code = system(cmd);
    if (exit_code == -1) {
        perror("调用 dee.exe 失败");
    }
#endif

    system("pause");
    return exit_code;
}
